// ── Horaires officiels du Centre Médical Dorigny ─────────────────
// Source unique de vérité pour tous les calculs d'heures (planning, soldes,
// dashboard RH, export comptabilité, statistiques).
//
//   Lundi → Vendredi : 08h30–12h30 + 13h30–17h00  (7h30 nettes / jour)
//   Samedi, Dimanche : fermé
//
//   Imene (apprentie)       : lundi et mardi uniquement (école le reste)
//   Dessa, Bledi, Dr Bezioune et tout autre collaborateur : lundi → vendredi
import { eachDayOfInterval, getDay } from 'date-fns'

export const MATIN = { debut: '08:30', fin: '12:30' }
export const APREM = { debut: '13:30', fin: '17:00' }
export const HORAIRE_MATIN = `${MATIN.debut}–${MATIN.fin}`
export const HORAIRE_APREM = `${APREM.debut}–${APREM.fin}`
export const DAY_MIN = 450 // 7h30

export const IMENE_ID = '00000000-0000-0000-0000-000000000001'

const CABINET_DAYS = [1, 2, 3, 4, 5]
const IMENE_DAYS   = [1, 2]

// 1 = lundi … 7 = dimanche
export const jourSemaine = (date) => (getDay(date) === 0 ? 7 : getDay(date))

export const workDaysFor = (userId) => (userId === IMENE_ID ? IMENE_DAYS : CABINET_DAYS)

export const worksOn = (userId, date) => workDaysFor(userId).includes(jourSemaine(date))

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
