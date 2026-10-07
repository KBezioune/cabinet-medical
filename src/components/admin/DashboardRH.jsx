import { useState, useEffect } from 'react'
import { getUsers } from '../../lib/localData'
import { getPointagesByDateRange, getAllConges } from '../../lib/db'
import { format, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import { minutesToHHMM } from '../../utils/dateUtils'
import { plannedMinutesFor, isOnApprovedLeave, computeVacances } from '../../utils/horaires'
import Breadcrumb from '../shared/Breadcrumb'
import './DashboardRH.css'

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: format(new Date(2024, i, 1), 'MMMM', { locale: fr }),
}))

const formatSolde = (min) => {
  if (min === 0) return '±0h'
  const sign = min > 0 ? '+' : '−'
  const abs = Math.abs(min)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

const TODAY     = format(new Date(), 'yyyy-MM-dd')
const THIS_YEAR = new Date().getFullYear()
// Période affichée par défaut à l'ouverture du dashboard
const DEFAULT_YEAR  = 2026
const DEFAULT_MONTH = 10

export default function DashboardRH() {
  const [year,  setYear]    = useState(DEFAULT_YEAR)
  const [month, setMonth]   = useState(DEFAULT_MONTH)
  const [pointages, setPointages] = useState([])
  const [conges,    setConges]    = useState([])
  const [loading,   setLoading]   = useState(true)

  const collaborateurs = getUsers().filter(u => u.role !== 'admin')

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const ids = collaborateurs.map(u => u.id)
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

  const computeStats = (userId) => {
    const userPts  = pointages.filter(p => p.user_id === userId)

    const days = eachDayOfInterval({
      start: new Date(year, month - 1, 1),
      end:   new Date(year, month, 0),
    })

    let plannedMin = 0
    let workedMin  = 0
    let absences   = 0

    days.forEach(d => {
      const dateStr  = format(d, 'yyyy-MM-dd')
      const pt       = userPts.find(p => p.date === dateStr)
      // Horaires officiels ; un jour de congé approuvé n'est pas dû
      const dayPlan  = isOnApprovedLeave(userId, dateStr, conges) ? 0 : plannedMinutesFor(userId, d)
      const dayWork  = pt?.duree_minutes || 0

      plannedMin += dayPlan // mois complet
      workedMin  += dayWork
      if (dayPlan > 0 && dayWork === 0 && dateStr <= TODAY) absences++
    })

    const balance      = workedMin - plannedMin
    const tauxActivite = plannedMin > 0 ? Math.round((workedMin / plannedMin) * 100) : null

    const congesApprouves = conges.filter(c =>
      c.user_id === userId &&
      c.statut === 'approuve' &&
      c.date_debut <= to &&
      c.date_fin >= from
    ).length

    const vac = computeVacances(userId, conges, THIS_YEAR)

    return { plannedMin, workedMin, balance, absences, tauxActivite, congesApprouves, vac }
  }

  const allStats = collaborateurs.map(u => ({ user: u, ...computeStats(u.id) }))

  // KPI globaux
  const totalWorkedMin    = allStats.reduce((s, r) => s + r.workedMin, 0)
  const totalPlannedMin   = allStats.reduce((s, r) => s + r.plannedMin, 0)
  const totalCongesPending = conges.filter(c => c.statut === 'en_attente').length
  const totalAbsences     = allStats.reduce((s, r) => s + r.absences, 0)
  const validTaux         = allStats.filter(r => r.tauxActivite !== null)
  const tauxEquipe        = validTaux.length > 0
    ? Math.round(validTaux.reduce((s, r) => s + r.tauxActivite, 0) / validTaux.length)
    : null

  const exportCSV = () => {
    const headers = ['Nom', 'Rôle', 'Heures planifiées', 'Heures travaillées', 'Solde', 'Taux activité', 'Congés approuvés', 'Absences', 'Statut']
    const rows = allStats.map(r => {
      const alerts = []
      if (r.balance < -300) alerts.push('Solde critique')
      if (r.tauxActivite !== null && r.tauxActivite < 80) alerts.push('Taux faible')
      return [
        r.user.name,
        r.user.role === 'manager' ? 'Manager' : r.user.poste || 'Assistante',
        minutesToHHMM(r.plannedMin),
        minutesToHHMM(r.workedMin),
        formatSolde(r.balance),
        r.tauxActivite !== null ? `${r.tauxActivite}%` : 'N/A',
        r.congesApprouves,
        r.absences,
        alerts.length > 0 ? alerts.join(' / ') : 'OK',
      ]
    })
    const csvContent = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `dashboard-rh-${year}-${String(month).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: fr })

  return (
    <div className="drh-wrap">
      <Breadcrumb items={['Centre Médical Dorigny', 'Équipe', 'Dashboard RH']} />
      {/* Barre de contrôle */}
      <div className="card drh-controls">
        <div>
          <h2 className="drh-title">Dashboard RH</h2>
          <p className="drh-period">{monthLabel}</p>
        </div>
        <div className="drh-actions">
          <div className="drh-selects">
            <select value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}>
              {[THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button className="btn btn-outline drh-export-btn" onClick={exportCSV}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* 4 cartes KPI */}
      <div className="drh-kpi-grid">
        <div className="card drh-kpi">
          <div className="drh-kpi-icon drh-icon-blue">⏰</div>
          <div className="drh-kpi-body">
            <span className="drh-kpi-val">{minutesToHHMM(totalWorkedMin)}</span>
            <span className="drh-kpi-lbl">Heures travaillées</span>
            <span className="drh-kpi-sub">/ {minutesToHHMM(totalPlannedMin)} planifiées</span>
          </div>
        </div>

        <div className={`card drh-kpi ${totalCongesPending > 0 ? 'drh-kpi-warn' : ''}`}>
          <div className="drh-kpi-icon drh-icon-orange">🌴</div>
          <div className="drh-kpi-body">
            <span className="drh-kpi-val">{totalCongesPending}</span>
            <span className="drh-kpi-lbl">Congés en attente</span>
            <span className="drh-kpi-sub">demandes à valider</span>
          </div>
        </div>

        <div className={`card drh-kpi ${totalAbsences > 5 && totalWorkedMin > 0 ? 'drh-kpi-danger' : ''}`}>
          <div className="drh-kpi-icon drh-icon-red">⚠️</div>
          <div className="drh-kpi-body">
            <span className="drh-kpi-val">{totalAbsences}</span>
            <span className="drh-kpi-lbl">Jours d'absence</span>
            <span className="drh-kpi-sub">sur la période</span>
          </div>
        </div>

        <div className={`card drh-kpi ${tauxEquipe !== null && tauxEquipe < 80 && totalWorkedMin > 0 ? 'drh-kpi-danger' : ''}`}>
          <div className="drh-kpi-icon drh-icon-green">📈</div>
          <div className="drh-kpi-body">
            <span className="drh-kpi-val">{tauxEquipe !== null ? `${tauxEquipe}%` : '—'}</span>
            <span className="drh-kpi-lbl">Taux moyen équipe</span>
            <span className="drh-kpi-sub">taux d'activité</span>
          </div>
        </div>
      </div>

      {/* Tableau par collaborateur */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="card drh-table-card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Collaborateur</th>
                  <th>Heures planifiées</th>
                  <th>Heures travaillées</th>
                  <th>Solde</th>
                  <th>Taux activité</th>
                  <th>Vacances {THIS_YEAR}</th>
                  <th>Absences</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {allStats.map(r => {
                  const noPointage   = r.workedMin === 0
                  const balanceAlert = r.balance < -300 && !noPointage
                  const tauxAlert    = r.tauxActivite !== null && r.tauxActivite < 80 && !noPointage
                  const hasAlert     = balanceAlert || tauxAlert
                  const soldeClass   = r.balance > 0 ? 'pos' : (r.balance < 0 && !noPointage) ? 'neg' : 'zero'

                  return (
                    <tr key={r.user.id} className={hasAlert ? 'drh-row-alert' : ''}>
                      <td>
                        <div className="drh-collab">
                          <div className="drh-avatar">{r.user.name[0]}</div>
                          <div>
                            <div className="drh-collab-name">{r.user.name}</div>
                            <div className="drh-collab-role">
                              {r.user.role === 'manager' ? 'Manager' : r.user.poste || 'Assistante'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>{minutesToHHMM(r.plannedMin)}</td>

                      <td>
                        <span className="badge badge-blue">{minutesToHHMM(r.workedMin)}</span>
                      </td>

                      <td>
                        {noPointage ? (
                          <span className="drh-no-pointage">Aucun pointage</span>
                        ) : (
                          <span className={`sh-badge-solde sh-badge-${soldeClass}${balanceAlert ? ' drh-badge-crit' : ''}`}>
                            {formatSolde(r.balance)}
                          </span>
                        )}
                      </td>

                      <td>
                        {noPointage ? (
                          <span className="sh-dash">—</span>
                        ) : r.tauxActivite !== null ? (
                          <div className="drh-taux-wrap">
                            <div className="drh-taux-bar">
                              <div
                                className={`drh-taux-fill${tauxAlert ? ' drh-taux-alert' : r.tauxActivite >= 100 ? ' drh-taux-over' : ''}`}
                                style={{ width: `${Math.min(r.tauxActivite, 100)}%` }}
                              />
                            </div>
                            <span className={`drh-taux-pct${tauxAlert ? ' drh-taux-pct-alert' : ''}`}>
                              {r.tauxActivite}%
                            </span>
                          </div>
                        ) : <span className="sh-dash">—</span>}
                      </td>

                      <td>
                        <div className={`drh-vac ${r.vac.restant <= 3 ? 'drh-vac-low' : ''}`}>
                          <span className="drh-vac-restant">🌴 {r.vac.restant}j restants</span>
                          <span className="drh-vac-detail">{r.vac.consomme} / {r.vac.quota}j consommés</span>
                        </div>
                      </td>

                      <td>
                        {r.absences > 0
                          ? <span className="badge badge-orange">{r.absences}j</span>
                          : <span className="badge badge-green">0</span>}
                      </td>

                      <td>
                        {noPointage ? (
                          <span className="drh-no-pointage">Aucun pointage</span>
                        ) : hasAlert ? (
                          <div className="drh-chips">
                            {balanceAlert && <span className="drh-chip-alert">Solde critique</span>}
                            {tauxAlert    && <span className="drh-chip-alert">Taux faible</span>}
                          </div>
                        ) : (
                          <span className="badge badge-green">✓ OK</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
