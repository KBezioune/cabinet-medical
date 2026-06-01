import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getPlanningByUser, getPointagesByUserAndMonth, getCongesByUser } from '../../lib/db'
import { format, eachDayOfInterval, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import { minutesToHHMM, currentMonthYear, planNetMinutes } from '../../utils/dateUtils'
import Breadcrumb from '../shared/Breadcrumb'
import CircularGauge from '../shared/CircularGauge'
import '../shared/CircularGauge.css'
import './MonSolde.css'

const timeToMin = (t) => {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const formatSolde = (min) => {
  if (min === 0) return '±0h00'
  const sign = min > 0 ? '+' : '−'
  const abs  = Math.abs(min)
  const h    = Math.floor(abs / 60)
  const m    = abs % 60
  return `${sign}${h}h${String(m).padStart(2, '0')}`
}

const TODAY       = format(new Date(), 'yyyy-MM-dd')
const OPEN_DAYS   = new Set([1, 2, 4, 5])
const DEFAULT_DAY_MIN = 420

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

const computeVacances = (conges) => {
  const consomme = conges
    .filter(c => c.statut === 'approuve' &&
                 c.date_debut <= YEAR_END && c.date_fin >= YEAR_START)
    .reduce((sum, c) => {
      const debut = c.date_debut < YEAR_START ? YEAR_START : c.date_debut
      const fin   = c.date_fin   > YEAR_END   ? YEAR_END   : c.date_fin
      return sum + countWorkingDays(debut, fin)
    }, 0)
  return { quota: VAC_QUOTA, consomme, restant: Math.max(0, VAC_QUOTA - consomme) }
}

export default function MonSolde() {
  const { user } = useAuth()
  const { year: cy, month: cm } = currentMonthYear()
  const [year,  setYear]    = useState(cy)
  const [month, setMonth]   = useState(cm)
  const [planning,  setPlanning]  = useState([])
  const [pointages, setPointages] = useState([])
  const [conges,    setConges]    = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const from = `${year}-${String(month).padStart(2, '0')}-01`
      const to   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`
      try {
        const [pl, pt, cg] = await Promise.all([
          getPlanningByUser(user.id),
          getPointagesByUserAndMonth(user.id, from, to),
          getCongesByUser(user.id),
        ])
        setPlanning(pl)
        setPointages(pt)
        setConges(cg)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [year, month, user.id])

  const days = eachDayOfInterval({
    start: new Date(year, month - 1, 1),
    end:   new Date(year, month, 0),
  })

  let totalPlanned = 0
  let totalWorked  = 0
  const details    = []

  days.forEach(d => {
    const dateStr = format(d, 'yyyy-MM-dd')
    const jourSem = getDay(d) === 0 ? 7 : getDay(d)
    const plan    = planning.find(p => p.jour_semaine === jourSem)
    const pt      = pointages.find(p => p.date === dateStr)
    const dayPlan = plan
      ? planNetMinutes(plan.heure_debut, plan.heure_fin)
      : (OPEN_DAYS.has(jourSem) ? DEFAULT_DAY_MIN : 0)
    const dayWork = pt?.duree_minutes || 0

    if (dateStr <= TODAY) totalPlanned += dayPlan
    totalWorked  += dayWork

    if (dayPlan > 0 || dayWork > 0) {
      details.push({ date: d, dateStr, planned: dayPlan, worked: dayWork, balance: dayWork - dayPlan, pt })
    }
  })

  const solde      = totalWorked - totalPlanned
  const soldeClass = solde > 0 ? 'pos' : (solde < 0 && totalWorked > 0) ? 'neg' : 'zero'
  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: fr })
  const vacances   = computeVacances(conges)
  const pct        = Math.min(Math.round((vacances.consomme / vacances.quota) * 100), 100)

  return (
    <div className="ms-wrap">
      <Breadcrumb items={['Mon espace', 'Mon Solde']} />
      {/* Sélecteur de période */}
      <div className="card ms-head">
        <div className="ms-period">
          <h2 className="section-title">Mon Solde d'heures</h2>
          <div className="ms-selects">
            <select value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}>
              {[cy - 1, cy, cy + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {/* Jauges circulaires */}
          <div className="card ms-gauges-card">
            <div className="ms-gauges-row">
              <CircularGauge
                value={Math.round(totalWorked / 60 * 10) / 10}
                max={Math.max(Math.round(totalPlanned / 60 * 10) / 10, 0.1)}
                color="var(--green-500)"
                label={`Heures travaillées / ${minutesToHHMM(totalPlanned)} planifiées`}
                unit="h"
                size={148}
              />
              <div className="ms-gauges-sep" />
              <CircularGauge
                value={vacances.restant}
                max={vacances.quota}
                color="#3b82f6"
                label={`Jours de vacances restants / ${vacances.quota} quota`}
                unit="j"
                size={148}
              />
            </div>
            <div className="ms-gauges-detail">
              <span className={`ms-badge ms-badge-${soldeClass}`}>{formatSolde(solde)}</span>
              <span className="ms-gauges-hint">
                {solde > 0 ? 'Heures supplémentaires' : solde < 0 ? 'Heures manquantes' : 'À l\'équilibre'}
              </span>
            </div>
          </div>

          {/* Tableau jour par jour */}
          <div className="card">
            <h3 className="ms-detail-title">Détail — {monthLabel}</h3>
            {details.length === 0 ? (
              <p className="ms-empty">Aucune donnée pour cette période.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Planifié</th>
                      <th>Travaillé</th>
                      <th>Solde</th>
                      <th>Arrivée → Départ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map(d => {
                      const dc = d.balance > 0 ? 'pos' : (d.balance < 0 && d.worked > 0) ? 'neg' : 'zero'
                      return (
                        <tr key={d.dateStr}>
                          <td className="ms-date-cell">
                            {format(d.date, 'EEE d MMM', { locale: fr })}
                          </td>
                          <td>
                            {d.planned > 0
                              ? <span className="ms-hours-gray">{minutesToHHMM(d.planned)}</span>
                              : <span className="ms-dash">—</span>
                            }
                          </td>
                          <td>
                            {d.worked > 0
                              ? <span className="badge badge-blue">{minutesToHHMM(d.worked)}</span>
                              : <span className="ms-dash">—</span>
                            }
                          </td>
                          <td>
                            <span className={`ms-badge ms-badge-${dc}`}>{formatSolde(d.balance)}</span>
                          </td>
                          <td className="ms-pt-cell">
                            {d.pt?.heure_arrivee
                              ? <>
                                  <span className="ms-arrive">{format(new Date(d.pt.heure_arrivee), 'HH:mm')}</span>
                                  {' → '}
                                  <span className="ms-depart">
                                    {d.pt.heure_depart ? format(new Date(d.pt.heure_depart), 'HH:mm') : '...'}
                                  </span>
                                </>
                              : <span className="ms-dash">—</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="total-row">
                      <td><strong>TOTAL</strong></td>
                      <td><strong>{minutesToHHMM(totalPlanned)}</strong></td>
                      <td><strong>{minutesToHHMM(totalWorked)}</strong></td>
                      <td>
                        <span className={`ms-badge ms-badge-${soldeClass} ms-badge-lg`}>
                          {formatSolde(solde)}
                        </span>
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
