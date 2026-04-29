import { useState, useEffect } from 'react'
import { getAssistants } from '../../lib/localData'
import { getPlanningForUsers, getPointagesByDateRange, getAllConges } from '../../lib/db'
import { format, eachDayOfInterval, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { minutesToHHMM, currentMonthYear } from '../../utils/dateUtils'
import './SoldeHeures.css'

const timeToMin = (t) => {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const formatSolde = (min) => {
  if (min === 0) return '±0'
  const sign = min > 0 ? '+' : '−'
  const abs  = Math.abs(min)
  const h    = Math.floor(abs / 60)
  const m    = abs % 60
  return `${sign}${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: format(new Date(2024, i, 1), 'MMMM', { locale: fr }),
}))

// ── Solde vacances ────────────────────────────────────────────
const VAC_QUOTA  = 20
const THIS_YEAR  = new Date().getFullYear()
const YEAR_START = `${THIS_YEAR}-01-01`
const YEAR_END   = `${THIS_YEAR}-12-31`

const countWorkingDays = (debut, fin) => {
  const s = new Date(debut + 'T12:00:00')
  const e = new Date(fin   + 'T12:00:00')
  if (s > e) return 0
  return eachDayOfInterval({ start: s, end: e })
    .filter(d => getDay(d) >= 1 && getDay(d) <= 5).length
}

const computeVacances = (userId, conges) => {
  const consomme = conges
    .filter(c => c.user_id === userId && c.statut === 'approuve' &&
                 c.date_debut <= YEAR_END && c.date_fin >= YEAR_START)
    .reduce((sum, c) => {
      const debut = c.date_debut < YEAR_START ? YEAR_START : c.date_debut
      const fin   = c.date_fin   > YEAR_END   ? YEAR_END   : c.date_fin
      return sum + countWorkingDays(debut, fin)
    }, 0)
  return { quota: VAC_QUOTA, consomme, restant: Math.max(0, VAC_QUOTA - consomme) }
}

export default function SoldeHeures() {
  const { year: cy, month: cm } = currentMonthYear()
  const [year,  setYear]   = useState(cy)
  const [month, setMonth]  = useState(cm)
  const [planning,  setPlanning]  = useState([])
  const [pointages, setPointages] = useState([])
  const [conges,    setConges]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState(null)

  const assistants = getAssistants()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const from = `${year}-${String(month).padStart(2, '0')}-01`
      const to   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
      const ids  = assistants.map(a => a.id)
      try {
        const [pl, pt, cg] = await Promise.all([
          getPlanningForUsers(ids),
          getPointagesByDateRange(ids, from, to),
          getAllConges(),
        ])
        setPlanning(pl)
        setPointages(pt)
        setConges(cg)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [year, month])

  const computeSolde = (userId) => {
    const userPlan = planning.filter(p => p.user_id === userId && p.actif)
    const userPts  = pointages.filter(p => p.user_id === userId)

    const days = eachDayOfInterval({
      start: new Date(year, month - 1, 1),
      end:   new Date(year, month, 0),
    })

    let plannedMin = 0
    let workedMin  = 0
    const details  = []

    days.forEach(d => {
      const dateStr    = format(d, 'yyyy-MM-dd')
      const jourSem    = getDay(d) === 0 ? 7 : getDay(d)
      const plan       = userPlan.find(p => p.jour_semaine === jourSem)
      const pt         = userPts.find(p => p.date === dateStr)
      const dayPlan    = plan ? timeToMin(plan.heure_fin) - timeToMin(plan.heure_debut) : 0
      const dayWorked  = pt?.duree_minutes || 0

      plannedMin += dayPlan
      workedMin  += dayWorked

      if (dayPlan > 0 || dayWorked > 0) {
        details.push({ date: d, dateStr, planned: dayPlan, worked: dayWorked, balance: dayWorked - dayPlan, pt })
      }
    })

    return { plannedMin, workedMin, balance: workedMin - plannedMin, details }
  }

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: fr })

  return (
    <div className="sh-wrap">
      {/* Sélecteurs */}
      <div className="card sh-controls">
        <h2 className="section-title">Soldes des heures</h2>
        <div className="sh-selects">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {[cy - 1, cy, cy + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="sh-list">
          {assistants.map(a => {
            const { plannedMin, workedMin, balance, details } = computeSolde(a.id)
            const vac      = computeVacances(a.id, conges)
            const isOpen   = expanded === a.id
            const soldeClass = balance > 0 ? 'pos' : (balance < 0 && workedMin > 0) ? 'neg' : 'zero'

            return (
              <div key={a.id} className="card sh-card">
                {/* Résumé */}
                <div className="sh-summary" onClick={() => setExpanded(isOpen ? null : a.id)}>
                  <div className="sh-avatar">{a.name[0]}</div>
                  <div className="sh-info">
                    <span className="sh-name">{a.name}</span>
                    <span className="sh-sub">{monthLabel}</span>
                  </div>
                  <div className="sh-stats">
                    <div className="sh-stat">
                      <span className="sh-stat-val">{minutesToHHMM(plannedMin)}</span>
                      <span className="sh-stat-lbl">Planifiées</span>
                    </div>
                    <div className="sh-stat">
                      <span className="sh-stat-val blue">{minutesToHHMM(workedMin)}</span>
                      <span className="sh-stat-lbl">Travaillées</span>
                    </div>
                    <div className={`sh-solde sh-solde-${soldeClass}`}>
                      <span className="sh-solde-val">{formatSolde(balance)}</span>
                      <span className="sh-solde-lbl">Solde</span>
                    </div>
                    {/* Solde vacances */}
                    <div className={`sh-vac ${vac.restant <= 3 ? 'sh-vac-low' : ''}`}>
                      <span className="sh-vac-icon">🌴</span>
                      <div className="sh-vac-body">
                        <span className="sh-vac-main">{vac.restant}j restants</span>
                        <span className="sh-vac-sub">{vac.consomme}/{vac.quota}j</span>
                      </div>
                    </div>
                  </div>
                  <button className={`sh-toggle ${isOpen ? 'open' : ''}`} title="Détail">▾</button>
                </div>

                {/* Détail jour par jour */}
                {isOpen && (
                  <div className="sh-detail">
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Planifié</th>
                            <th>Travaillé</th>
                            <th>Solde du jour</th>
                            <th>Pointage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.map(d => {
                            const dc = d.balance > 0 ? 'pos' : (d.balance < 0 && d.worked > 0) ? 'neg' : 'zero'
                            return (
                              <tr key={d.dateStr}>
                                <td className="sh-date-cell">
                                  {format(d.date, 'EEE d MMM', { locale: fr })}
                                </td>
                                <td>{d.planned > 0 ? minutesToHHMM(d.planned) : <span className="sh-dash">—</span>}</td>
                                <td>
                                  {d.worked > 0
                                    ? <span className="badge badge-blue">{minutesToHHMM(d.worked)}</span>
                                    : <span className="sh-dash">—</span>
                                  }
                                </td>
                                <td>
                                  <span className={`sh-badge-solde sh-badge-${dc}`}>
                                    {formatSolde(d.balance)}
                                  </span>
                                </td>
                                <td className="sh-pt-cell">
                                  {d.pt?.heure_arrivee
                                    ? `${format(new Date(d.pt.heure_arrivee), 'HH:mm')} → ${d.pt.heure_depart ? format(new Date(d.pt.heure_depart), 'HH:mm') : '...'}`
                                    : <span className="sh-dash">—</span>
                                  }
                                </td>
                              </tr>
                            )
                          })}
                          <tr className="total-row">
                            <td><strong>TOTAL</strong></td>
                            <td><strong>{minutesToHHMM(plannedMin)}</strong></td>
                            <td><strong>{minutesToHHMM(workedMin)}</strong></td>
                            <td>
                              <span className={`sh-badge-solde sh-badge-${soldeClass} sh-badge-lg`}>
                                {formatSolde(balance)}
                              </span>
                            </td>
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
        </div>
      )}
    </div>
  )
}
