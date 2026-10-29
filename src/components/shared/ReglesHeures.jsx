import { minutesToHHMM } from '../../utils/dateUtils'
import { DAY_MIN, HORAIRE_MATIN, HORAIRE_APREM } from '../../utils/horaires'

// Encart repliable qui explique en clair comment les heures sont calculées.
// Affiché sur les écrans RH pour que chaque chiffre soit compréhensible.
export default function ReglesHeures() {
  return (
    <details className="regles-heures">
      <summary>Comment sont calculées les heures ?</summary>
      <ul>
        <li>
          <strong>Journée type : {minutesToHHMM(DAY_MIN)}</strong> du lundi au vendredi
          ({HORAIRE_MATIN} puis {HORAIRE_APREM}, pause de 30 min). Imene : lundi et mardi uniquement.
        </li>
        <li>
          <strong>Heures travaillées</strong> = de l'arrivée au départ, moins toutes les pauses pointées.
          La pause est libre : seul le total de la journée compte.
        </li>
        <li>
          <strong>Heures dues</strong> = jours ouvrés écoulés depuis le 1er du mois × {minutesToHHMM(DAY_MIN)},
          congés approuvés déduits.
        </li>
        <li>
          <strong>Solde</strong> = heures travaillées − heures dues. Positif : en avance. Négatif : en retard.
        </li>
        <li>
          Un collaborateur dont le compte est désactivé n'a plus d'heures dues : on garde seulement ses heures effectuées.
        </li>
      </ul>
    </details>
  )
}
