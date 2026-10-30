import { minutesToHHMM } from './dateUtils'

// Traduit un écart d'heures en phrase claire (utilisé par Soldes, Dashboard RH et Export).
//   balance   = heures faites − heures attendues (en minutes)
//   workedMin = heures faites (0 → on ne juge pas : aucun pointage)
export const statutHeures = (balance, workedMin) => {
  if (workedMin === 0)
    return { classe: 'none', titre: 'Aucun pointage', detail: 'Rien à comparer pour le moment' }
  if (balance >= -30 && balance <= 30)
    return { classe: 'ok', titre: 'À jour', detail: 'Heures faites = heures attendues' }
  if (balance > 30)
    return { classe: 'ok', titre: `${minutesToHHMM(balance)} en avance`, detail: 'Plus d\'heures que prévu' }
  return { classe: 'late', titre: `Il manque ${minutesToHHMM(-balance)}`, detail: 'Moins d\'heures que prévu' }
}

// Pourcentage de la barre de progression (0–100)
export const pourcentFait = (workedMin, plannedMin) =>
  plannedMin > 0 ? Math.min(100, Math.round((workedMin / plannedMin) * 100)) : 0
