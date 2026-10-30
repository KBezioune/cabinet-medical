// ── Horaires officiels du Centre Médical Dorigny ─────────────────
// Source unique de vérité pour tous les calculs d'heures (planning, soldes,
// dashboard RH, export comptabilité, statistiques).
//
//   Lundi → Vendredi : 08h30–12h30 + 13h00–17h24  (8h24 nettes / jour)
//   Pause de 30 min (12h30–13h00 par défaut) : l'heure réelle de la pause
//   est libre, seul le total journalier de 8h24 compte.
//   Samedi, Dimanche : fermé
//
//   Imene (apprentie)       : lundi et mardi uniquement (école le reste)
//   Dessa, Bledi, Dr Bezioune et tout autre collaborateur : lundi → vendredi
import { eachDayOfInterval, getDay, format } from 'date-fns'

export const MATIN = { debut: '08:30', fin: '12:30' }
export const APREM = { debut: '13:00', fin: '17:24' }
export const HORAIRE_MATIN = `${MATIN.debut}–${MATIN.fin}`
export const HORAIRE_APREM = `${APREM.debut}–${APREM.fin}`
export const DAY_MIN = 504 // 8h24

export const IMENE_ID = '00000000-0000-0000-0000-000000000001'

const CABINET_DAYS = [1, 2, 3, 4, 5]
const IMENE_DAYS   = [1, 2]

// 1 = lundi … 7 = dimanche
export const jourSemaine = (date) => (getDay(date) === 0 ? 7 : getDay(date))

export const workDaysFor = (userId) => (userId === IMENE_ID ? IMENE_DAYS : CABINET_DAYS)

// ── Jours fériés du canton de Vaud ──────────────────────────────────
// Le cabinet est fermé ces jours-là : aucune heure n'est due.
// À VÉRIFIER chaque année avec le calendrier officiel du canton de Vaud.
// Fêtes mobiles calculées à partir de Pâques (algorithme de Meeus/Jones/Butcher).
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const easterSunday = (y) => {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(y, month - 1, day)
}

const feriesCache = {}
export const joursFeries = (year) => {
  if (feriesCache[year]) return feriesCache[year]
  const paques = easterSunday(year)
  // Lundi du Jeûne fédéral = lundi qui suit le 3e dimanche de septembre
  const sept1 = new Date(year, 8, 1)
  const premierDimanche = addDays(sept1, (7 - sept1.getDay()) % 7)
  const jeune = addDays(premierDimanche, 15)
  const map = {
    [`${year}-01-01`]: 'Nouvel An',
    [`${year}-01-02`]: 'Lendemain du Nouvel An',
    [iso(addDays(paques, -2))]: 'Vendredi Saint',
    [iso(addDays(paques, 1))]:  'Lundi de Pâques',
    [iso(addDays(paques, 39))]: 'Ascension',
    [iso(addDays(paques, 50))]: 'Lundi de Pentecôte',
    [`${year}-08-01`]: 'Fête nationale',
    [iso(jeune)]: 'Lundi du Jeûne fédéral',
    [`${year}-12-25`]: 'Noël',
  }
  feriesCache[year] = map
  return map
}

// Nom du jour férié pour une date ISO (yyyy-MM-dd), ou null
export const ferieName = (dateStr) => joursFeries(Number(dateStr.slice(0, 4)))[dateStr] || null

// Le collaborateur travaille-t-il ce jour-là ? (jour de la semaine ET pas férié)
export const worksOn = (userId, date) =>
  workDaysFor(userId).includes(jourSemaine(date)) && !ferieName(iso(date))

// Minutes planifiées pour un collaborateur un jour donné (0 si non travaillé)
export const plannedMinutesFor = (userId, date) => (worksOn(userId, date) ? DAY_MIN : 0)

// Heures hebdomadaires contractuelles déduites des horaires officiels
export const weeklyMinutesFor = (userId) => workDaysFor(userId).length * DAY_MIN

const toDate = (iso) => new Date(iso + 'T12:00:00')

// Jours travaillés (selon les horaires du collaborateur) entre deux dates ISO incluses
export const countWorkDays = (userId, debut, fin) => {
  const s = toDate(debut)
  const e = toDate(fin)
  if (s > e) return 0
  return eachDayOfInterval({ start: s, end: e }).filter(d => worksOn(userId, d)).length
}

// Heures planifiées du mois complet : tous les jours travaillés du mois
// (lun→ven, ou lun/mar pour Imene) × 8h24, hors congés approuvés.
// month = 1…12
export const monthPlannedMinutes = (userId, year, month, conges = []) =>
  eachDayOfInterval({ start: new Date(year, month - 1, 1), end: new Date(year, month, 0) })
    .filter(d => !isOnApprovedLeave(userId, format(d, 'yyyy-MM-dd'), conges))
    .reduce((sum, d) => sum + plannedMinutesFor(userId, d), 0)

// Heures dues du mois jusqu'à une date incluse (yyyy-MM-dd) — sert pour le mois en cours.
// Sans date limite : mois complet.
export const monthDueMinutes = (userId, year, month, conges = [], untilStr = null) =>
  eachDayOfInterval({ start: new Date(year, month - 1, 1), end: new Date(year, month, 0) })
    .filter(d => !untilStr || format(d, 'yyyy-MM-dd') <= untilStr)
    .filter(d => !isOnApprovedLeave(userId, format(d, 'yyyy-MM-dd'), conges))
    .reduce((sum, d) => sum + plannedMinutesFor(userId, d), 0)

// Le jour est-il couvert par un congé approuvé ?
export const isOnApprovedLeave = (userId, dateStr, conges) =>
  conges.some(c =>
    c.user_id === userId && c.statut === 'approuve' &&
    c.date_debut <= dateStr && c.date_fin >= dateStr
  )

// ── Solde vacances annuel ─────────────────────────────────────────
export const VAC_QUOTA = 20

export const computeVacances = (userId, conges, year = new Date().getFullYear()) => {
  const yStart = `${year}-01-01`
  const yEnd   = `${year}-12-31`
  const consomme = conges
    .filter(c => c.user_id === userId && c.statut === 'approuve' &&
                 c.date_debut <= yEnd && c.date_fin >= yStart)
    .reduce((sum, c) => {
      const debut = c.date_debut < yStart ? yStart : c.date_debut
      const fin   = c.date_fin   > yEnd   ? yEnd   : c.date_fin
      return sum + countWorkDays(userId, debut, fin)
    }, 0)
  return { quota: VAC_QUOTA, consomme, restant: Math.max(0, VAC_QUOTA - consomme) }
}
