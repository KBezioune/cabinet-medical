// Vérifie les règles de calcul des heures (planning 8h24, pauses libres, comptes désactivés).
// Lancer : node scripts/verifier-calculs.mjs
import { summarizePointageEvents, minutesToHHMM } from '../src/utils/dateUtils.js'
import { DAY_MIN, plannedMinutesFor, monthPlannedMinutes, IMENE_ID } from '../src/utils/horaires.js'

let ko = 0
const check = (nom, obtenu, attendu) => {
  const ok = obtenu === attendu
  if (!ok) ko++
  console.log(`${ok ? 'OK ' : 'ECHEC'}  ${nom} → ${obtenu}${ok ? '' : ` (attendu ${attendu})`}`)
}
const ev = (type, hhmm) => ({ type, heure: `2026-10-26T${hhmm}:00Z` })
const duree = (...e) => summarizePointageEvents(e).duree_minutes

check('Journée officielle = 8h24', minutesToHHMM(DAY_MIN), '8h24')
check('08:30→17:24 avec pause 12:30-13:00', minutesToHHMM(duree(
  ev('arrivee', '08:30'), ev('pause_debut', '12:30'), ev('pause_fin', '13:00'), ev('depart', '17:24'))), '8h24')
check('Même total si la pause est prise plus tôt (11:00-11:30)', minutesToHHMM(duree(
  ev('arrivee', '08:30'), ev('pause_debut', '11:00'), ev('pause_fin', '11:30'), ev('depart', '17:24'))), '8h24')
check('Deux pauses (10 min + 40 min), départ 17:34', minutesToHHMM(duree(
  ev('arrivee', '08:30'), ev('pause_debut', '10:00'), ev('pause_fin', '10:10'),
  ev('pause_debut', '12:30'), ev('pause_fin', '13:10'), ev('depart', '17:34'))), '8h14')
check('Pause oubliée de clôturer : comptée jusqu\'au départ', minutesToHHMM(duree(
  ev('arrivee', '08:30'), ev('pause_debut', '12:30'), ev('depart', '13:00'))), '4h00')
check('Pas de départ : durée inconnue', duree(ev('arrivee', '08:30')), null)
check('Arrivée en double : la première compte', minutesToHHMM(duree(
  ev('arrivee', '08:30'), ev('arrivee', '08:31'), ev('depart', '12:30'))), '4h00')

const lundi = new Date(2026, 9, 26), samedi = new Date(2026, 9, 24)
check('Lundi = 8h24 dues', plannedMinutesFor('x', lundi), 504)
check('Samedi = 0 dues', plannedMinutesFor('x', samedi), 0)
check('Imene : lundi dû, mercredi non', [plannedMinutesFor(IMENE_ID, lundi), plannedMinutesFor(IMENE_ID, new Date(2026, 9, 28))].join('/'), '504/0')
check('Octobre 2026 : 22 jours × 8h24 = 184h48', minutesToHHMM(monthPlannedMinutes('x', 2026, 10)), '184h48')
check('Octobre 2026 Imene : 8 jours = 67h12', minutesToHHMM(monthPlannedMinutes(IMENE_ID, 2026, 10)), '67h12')
const conge = [{ user_id: 'x', statut: 'approuve', date_debut: '2026-10-26', date_fin: '2026-10-27' }]
check('2 jours de congé approuvé retirés du mois', minutesToHHMM(monthPlannedMinutes('x', 2026, 10, conge)), '168h00')
console.log(ko ? `\n${ko} échec(s)` : '\nTous les calculs sont corrects.')
process.exit(ko ? 1 : 0)
