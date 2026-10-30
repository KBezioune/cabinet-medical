import { useState, useEffect } from 'react'
import { getUsers } from '../../lib/localData'
import { getPointagesByDateRange, getAllConges } from '../../lib/db'
import { format, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import { minutesToHHMM, currentMonthYear, MONTH_OPTIONS } from '../../utils/dateUtils'
import { plannedMinutesFor, isOnApprovedLeave, computeVacances, ferieName } from '../../utils/horaires'
import Breadcrumb from '../shared/Breadcrumb'
import ReglesHeures from '../shared/ReglesHeures'
import { Progression, Situation } from '../shared/SituationHeures'
import './SoldeHeures.css'

// Écart d'un jour dans le détail : « −8h24 », « +15 min », « ± 0 »
const formatEcart = (min) => {
  if (min === 0) return '±0'
  const sign = min > 0 ? '+' : '−'
  const abs  = Math.abs(min)
  return abs < 60 ? `${sign}${abs} min` : `${sign}${minutesToHHMM(abs)}`
}

export default function SoldeHeures() {
  const { year: cy, month: cm } = currentMonthYear()
  const [year,  setYear]   = useState(cy)
  const [month, setMonth]  = useState(cm)
  const [pointages, setPointages] = useState([])
  const [conges,    setConges]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState(null)

  const assistants = getUsers().filter(u => u.role !== 'admin')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const from = `${year}-${String(month).padStart(2, '0')}-01`
      const to   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
      const ids  = assistants.map(a => a.id)
      try {
        const [pt, cg] = await Promise.all([
          getPointagesByDateRange(ids, from, to),
          getAllConges(),
        ])
        setPointages(pt)
        setConges(cg)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [year, month])

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const computeSolde = (userId, inactive = false) => {
    const userPts = pointages.filter(p => p.user_id === userId)
    const days = eachDayOfInterval({
      start: new Date(year, month - 1, 1),
      end:   new Date(year, month, 0),
    })

    let plannedMin = 0, workedMin = 0, joursAttendus = 0, joursPointes = 0
    const details = []

    days.forEach(d => {
      const dateStr   = format(d, 'yyyy-MM-dd')
      const pt        = userPts.find(p => p.date === dateStr)
      const ferie     = ferieName(dateStr)
      const enConge   = isOnApprovedLeave(userId, dateStr, conges)
      // Heures attendues jusqu'à aujourd'hui ; compte désactivé = rien n'est attendu
      const dayPlan   = (inactive || dateStr > todayStr || enConge) ? 0 : plannedMinutesFor(userId, d)
      const dayWorked = pt?.duree_minutes || 0

      plannedMin += dayPlan
      workedMin  += dayWorked
      if (dayPlan > 0) joursAttendus++
      if (pt?.heure_arrivee) joursPointes++

      let note = ''
      if (ferie)               note = `Férié : ${ferie}`
      else if (enConge)        note = 'Congé approuvé'
      else if (dayPlan > 0 && !pt?.heure_arrivee && dateStr < todayStr) note = 'Pas de pointage'
      else if (pt?.heure_arrivee && !pt.heure_depart && dateStr < todayStr) note = 'Départ non pointé'

      if (dayPlan > 0 || dayWorked > 0 || (note && dateStr <= todayStr)) {
        details.push({ date: d, dateStr, planned: dayPlan, worked: dayWorked, ecart: dayWorked - dayPlan, pt, note })
      }
    })

    return { plannedMin, workedMin, balance: workedMin - plannedMin, joursAttendus, joursPointes, details }
  }

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: fr })
  const isCurrent  = year === cy && month === cm

  const rows = assistants.map(a => ({ a, ...computeSolde(a.id, a.actif === false) }))
  const actifs = rows.filter(r => r.a.actif !== false)
  const anciens = rows.filter(r => r.a.actif === false)

  return (
    <div className="sh-wrap">
      <Breadcrumb items={['Centre Médical Dorigny', 'RH', 'Heures de l\'équipe']} />

      <div className="card sh-controls">
        <div>
          <h2 className="section-title">Heures de l'équipe</h2>
          <p className="sh2-intro">
            Pour chaque personne : les heures faites <strong>comparées aux heures attendues</strong>
            {isCurrent ? ` jusqu'à aujourd'hui (${format(new Date(), 'd MMMM', { locale: fr })})` : ` sur tout le mois de ${monthLabel}`}.
          </p>
        </div>
        <div className="sh-selects">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {[cy - 1, cy, cy + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <ReglesHeures />

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="sh-list">
          {actifs.map(({ a, plannedMin, workedMin, balance, joursAttendus, joursPointes, details }) => {
            const vac    = computeVacances(a.id, conges, cy)
            const isOpen = expanded === a.id

            return (
              <div key={a.id} className="card sh-card">
                <div className="sh2-row">
                  <div className="sh2-who">
                    <div className="sh-avatar">{a.name[0]}</div>
                    <div>
                      <div className="sh-name">{a.name}</div>
                      <div className="sh-sub">{a.poste || 'Assistante médicale'}</div>
                    </div>
                  </div>

                  <Progression workedMin={workedMin} plannedMin={plannedMin} joursPointes={joursPointes} joursAttendus={joursAttendus} />
                  <Situation workedMin={workedMin} plannedMin={plannedMin} />
                </div>

                <div className="sh2-foot">
                  <span className="sh2-vac">🌴 {vac.restant} jour{vac.restant > 1 ? 's' : ''} de vacances restant{vac.restant > 1 ? 's' : ''} sur {vac.quota}</span>
                  <button className="sh2-more" onClick={() => setExpanded(isOpen ? null : a.id)} aria-expanded={isOpen}>
                    {isOpen ? 'Masquer le détail' : 'Voir le détail jour par jour'}
                  </button>
                </div>

                {isOpen && (
                  <div className="sh-detail">
                    <div className="table-wrapper" tabIndex={0} role="region" aria-label={`Détail des jours de ${a.name}`}>
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Jour</th>
                            <th scope="col">Arrivée → départ</th>
                            <th scope="col">Heures faites</th>
                            <th scope="col">Heures attendues</th>
                            <th scope="col">Écart</th>
                            <th scope="col">Remarque</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.map(d => (
                            <tr key={d.dateStr} className={d.note ? 'sh2-tr-note' : ''}>
                              <td className="sh-date-cell">{format(d.date, 'EEE d MMM', { locale: fr })}</td>
                              <td className="sh-pt-cell">
                                {d.pt?.heure_arrivee
                                  ? `${format(new Date(d.pt.heure_arrivee), 'HH:mm')} → ${d.pt.heure_depart ? format(new Date(d.pt.heure_depart), 'HH:mm') : '…'}`
                                  : <span className="sh-dash">—</span>}
                              </td>
                              <td>{d.worked > 0 ? <strong>{minutesToHHMM(d.worked)}</strong> : <span className="sh-dash">—</span>}</td>
                              <td>{d.planned > 0 ? minutesToHHMM(d.planned) : <span className="sh-dash">—</span>}</td>
                              <td>
                                {(d.planned > 0 || d.worked > 0)
                                  ? <span className={d.ecart < 0 ? 'sh2-neg' : d.ecart > 0 ? 'sh2-pos' : ''}>{formatEcart(d.ecart)}</span>
                                  : <span className="sh-dash">—</span>}
                              </td>
                              <td className="sh2-note">{d.note}</td>
                            </tr>
                          ))}
                          <tr className="total-row">
                            <td colSpan={2}><strong>TOTAL</strong></td>
                            <td><strong>{minutesToHHMM(workedMin)}</strong></td>
                            <td><strong>{minutesToHHMM(plannedMin)}</strong></td>
                            <td><strong>{formatEcart(balance)}</strong></td>
                            <td />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {anciens.length > 0 && (
            <>
              <h3 className="sh2-section">Anciens collaborateurs <span>(heures effectuées uniquement)</span></h3>
              {anciens.map(({ a, workedMin }) => (
                <div key={a.id} className="card sh-card sh2-ancien">
                  <div className="sh2-who">
                    <div className="sh-avatar">{a.name[0]}</div>
                    <div>
                      <div className="sh-name">{a.name}</div>
                      <div className="sh-sub">Ne travaille plus au cabinet</div>
                    </div>
                  </div>
                  <div className="sit-figures"><span><strong>{minutesToHHMM(workedMin)}</strong> faites en {monthLabel}</span></div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
