import { differenceInMinutes } from 'date-fns'

export const USERS = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Sophie',    pin: '2001', role: 'assistant' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Camille',   pin: '2002', role: 'assistant' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Léa',       pin: '2003', role: 'assistant' },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Dr. Admin', pin: '1234', role: 'admin'     },
]

export const getAssistants = () => USERS.filter(u => u.role === 'assistant')
export const getUserById   = (id) => USERS.find(u => u.id === id)

const load = (key) => JSON.parse(localStorage.getItem(key) || '[]')
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val))
const genId = () => crypto.randomUUID()

const calcDuree = (arrivee, depart) => {
  if (!arrivee || !depart) return null
  return differenceInMinutes(new Date(depart), new Date(arrivee))
}

// ── POINTAGES ────────────────────────────────────────────────
const PT_KEY = 'cabinet_pointages'

const loadPointages = () => load(PT_KEY)
const savePointages = (pts) => save(PT_KEY, pts)

export const getPointageByUserAndDate = (userId, date) =>
  loadPointages().find(p => p.user_id === userId && p.date === date) ?? null

export const getPointagesByUserAndMonth = (userId, from, to) =>
  loadPointages()
    .filter(p => p.user_id === userId && p.date >= from && p.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date))

export const getPointagesByDateRange = (userIds, from, to) =>
  loadPointages().filter(p => userIds.includes(p.user_id) && p.date >= from && p.date <= to)

export const getAllPointagesFiltered = ({ userId, date } = {}) => {
  let pts = loadPointages()
  if (userId) pts = pts.filter(p => p.user_id === userId)
  if (date)   pts = pts.filter(p => p.date === date)
  return pts
    .sort((a, b) => b.date.localeCompare(a.date) || (b.heure_arrivee || '').localeCompare(a.heure_arrivee || ''))
    .map(p => ({ ...p, users: getUserById(p.user_id) }))
}

export const insertPointage = (data) => {
  const pts = loadPointages()
  const record = {
    ...data,
    id: genId(),
    created_at: new Date().toISOString(),
    duree_minutes: calcDuree(data.heure_arrivee, data.heure_depart),
  }
  savePointages([...pts, record])
  return record
}

export const updatePointage = (id, data) => {
  const pts = loadPointages()
  const idx = pts.findIndex(p => p.id === id)
  if (idx === -1) return null
  const updated = {
    ...pts[idx],
    ...data,
    duree_minutes: calcDuree(
      data.heure_arrivee ?? pts[idx].heure_arrivee,
      data.heure_depart  ?? pts[idx].heure_depart,
    ),
  }
  pts[idx] = updated
  savePointages(pts)
  return updated
}

export const deletePointage = (id) =>
  savePointages(loadPointages().filter(p => p.id !== id))

// ── PLANNING ─────────────────────────────────────────────────
const PL_KEY = 'cabinet_planning'

const loadPlanning = () => {
  const stored = load(PL_KEY)
  if (stored.length > 0) return stored
  // planning par défaut Lun-Ven 08h-17h
  const defaults = []
  getAssistants().forEach(u => {
    for (let j = 1; j <= 5; j++) {
      defaults.push({ id: genId(), user_id: u.id, jour_semaine: j, heure_debut: '08:00', heure_fin: '17:00', actif: true })
    }
  })
  save(PL_KEY, defaults)
  return defaults
}

export const getPlanningByUser = (userId) =>
  loadPlanning().filter(p => p.user_id === userId && p.actif)

export const getPlanningForUsers = (userIds) =>
  loadPlanning().filter(p => userIds.includes(p.user_id))

export const upsertPlanning = (userId, jour_semaine, heure_debut, heure_fin) => {
  const pl = loadPlanning()
  const idx = pl.findIndex(p => p.user_id === userId && p.jour_semaine === jour_semaine)
  const entry = {
    id: idx !== -1 ? pl[idx].id : genId(),
    user_id: userId,
    jour_semaine,
    heure_debut: heure_debut || null,
    heure_fin:   heure_fin   || null,
    actif: !!(heure_debut && heure_fin),
  }
  if (idx !== -1) pl[idx] = entry
  else pl.push(entry)
  save(PL_KEY, pl)
}
