import { minutesToHHMM } from '../../utils/dateUtils'
import { statutHeures, pourcentFait } from '../../utils/statutHeures'

// Bloc « 8h36 faites sur 184h48 attendues » + barre + jours pointés.
export function Progression({ workedMin, plannedMin, joursPointes, joursAttendus }) {
  const st  = statutHeures(workedMin - plannedMin, workedMin)
  const pct = pourcentFait(workedMin, plannedMin)
  return (
    <div className="sit-progress">
      <div className="sit-figures">
        <span><strong>{minutesToHHMM(workedMin)}</strong> faites</span>
        <span className="sit-sur">sur {minutesToHHMM(plannedMin)} attendues</span>
      </div>
      <div className="sit-bar" role="img" aria-label={`${pct} % des heures attendues`}>
        <div className={`sit-bar-fill sit-${st.classe}`} style={{ width: `${pct}%` }} />
      </div>
      {joursAttendus != null && (
        <div className="sit-days">
          {joursPointes} jour{joursPointes > 1 ? 's' : ''} pointé{joursPointes > 1 ? 's' : ''} sur {joursAttendus} à faire
        </div>
      )}
    </div>
  )
}

// Pastille « À jour » / « Il manque 176h12 » / « Aucun pointage ».
export function Situation({ workedMin, plannedMin }) {
  const st = statutHeures(workedMin - plannedMin, workedMin)
  return (
    <div className={`sit-status sit-${st.classe}`}>
      <div className="sit-status-title">{st.titre}</div>
      <div className="sit-status-detail">{st.detail}</div>
    </div>
  )
}
