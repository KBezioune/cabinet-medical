import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval,
  startOfMonth, endOfMonth, differenceInMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export const formatDate = (date) =>
  format(typeof date === 'string' ? parseISO(date) : date, 'dd/MM/yyyy', { locale: fr })

export const formatDateTime = (date) => {
  if (!date) return '—'
  return format(typeof date === 'string' ? parseISO(date) : date, 'HH:mm', { locale: fr })
}

export const formatDateLong = (date) =>
  format(typeof date === 'string' ? parseISO(date) : date, 'EEEE dd MMMM yyyy', { locale: fr })

export const formatMonthYear = (date) =>
  format(typeof date === 'string' ? parseISO(date) : date, 'MMMM yyyy', { locale: fr })

export const todayISO = () => format(new Date(), 'yyyy-MM-dd')

export const minutesToHHMM = (minutes) => {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h${m.toString().padStart(2, '0')}`
}

export const getWeekDays = (date = new Date()) => {
  const start = startOfWeek(date, { weekStartsOn: 1 })
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

export const getMonthDays = (year, month) => {
  const start = startOfMonth(new Date(year, month - 1))
  const end = endOfMonth(new Date(year, month - 1))
  return eachDayOfInterval({ start, end })
}

export const calcDuree = (arrivee, depart) => {
  if (!arrivee || !depart) return null
  const a = typeof arrivee === 'string' ? parseISO(arrivee) : arrivee
  const d = typeof depart === 'string' ? parseISO(depart) : depart
  return differenceInMinutes(d, a)
}

// Agrège le journal d'événements d'une journée (arrivée / pause_debut / pause_fin / départ,
// nombre illimité de pauses) en un résumé exploitable par l'UI et les calculs de paie.
export const summarizePointageEvents = (events) => {
  const sorted = [...events].sort((a, b) => new Date(a.heure) - new Date(b.heure))

  const heure_arrivee = sorted.find(e => e.type === 'arrivee')?.heure ?? null
  const departEvents  = sorted.filter(e => e.type === 'depart')
  const heure_depart  = departEvents.length ? departEvents[departEvents.length - 1].heure : null

  const pauses = []
  let openPause = null
  sorted.forEach(e => {
    if (e.type === 'pause_debut') openPause = e.heure
    else if (e.type === 'pause_fin' && openPause) {
      pauses.push({ debut: openPause, fin: e.heure })
      openPause = null
    }
  })
  const pause_minutes = pauses.reduce((s, p) => s + differenceInMinutes(parseISO(p.fin), parseISO(p.debut)), 0)

  const duree_minutes = (heure_arrivee && heure_depart)
    ? differenceInMinutes(parseISO(heure_depart), parseISO(heure_arrivee)) - pause_minutes
    : null

  return {
    heure_arrivee, heure_depart, duree_minutes,
    pauses, pause_minutes,
    en_pause: !!openPause,
    pause_debut_courante: openPause,
    events: sorted,
  }
}

// Statut courant d'une journée à partir de son résumé — 'absent' | 'present' | 'pause' | 'done'
export const pointageStatus = (summary) => {
  if (!summary?.heure_arrivee) return 'absent'
  if (summary.heure_depart)    return 'done'
  if (summary.en_pause)        return 'pause'
  return 'present'
}

export const currentMonthYear = () => {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export const isoToLocalTime = (isoString) => {
  if (!isoString) return ''
  return format(parseISO(isoString), 'HH:mm')
}

export const timeToMin = (t) => {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Pause déjeuner cabinet : 12:00 – 14:00 (120 min)
const LUNCH_START = 12 * 60  // 720
const LUNCH_END   = 14 * 60  // 840

// Minutes nettes travaillées sur une plage — déduit la pause si la plage la chevauche
export const planNetMinutes = (heure_debut, heure_fin) => {
  if (!heure_debut || !heure_fin) return 0
  const start = timeToMin(heure_debut)
  const end   = timeToMin(heure_fin)
  if (end <= start) return 0
  const gross        = end - start
  const overlapStart = Math.max(start, LUNCH_START)
  const overlapEnd   = Math.min(end,   LUNCH_END)
  return gross - Math.max(0, overlapEnd - overlapStart)
}
