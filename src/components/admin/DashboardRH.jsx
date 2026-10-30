import { useState, useEffect } from 'react'
import { getUsers } from '../../lib/localData'
import { getPointagesByDateRange, getAllConges } from '../../lib/db'
import { format, eachDayOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import { minutesToHHMM, MONTH_OPTIONS } from '../../utils/dateUtils'
import { plannedMinutesFor, isOnApprovedLeave, computeVacances } from '../../utils/horaires'
import Breadcrumb from '../shared/Breadcrumb'
import ReglesHeures from '../shared/ReglesHeures'
import { Progression, Situation } from '../shared/SituationHeures'
import './DashboardRH.css'

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

  const computeStats = (user) => {
    const userId = user.id
    const userPts  = pointages.filter(p => p.user_id === userId)

    const days = eachDayOfInterval({
      start: new Date(year, month - 1, 1),
      end:   new Date(year, month, 0),
    })

    let plannedMin = 0      // heures dues jusqu'à aujourd'hui (base du solde)
    let plannedMonthMin = 0 // heures planifiées sur le mois complet
    let workedMin  = 0
    let absences   = 0
    let joursAttendus = 0
    let joursPointes  = 0

    days.forEach(d => {
      const dateStr  = format(d, 'yyyy-MM-dd')
      const pt       = userPts.find(p => p.date === dateStr)
      // Horaires officiels ; un jour de congé approuvé n'est pas dû
      const dayPlan  = isOnApprovedLeave(userId, dateStr, conges) ? 0 : plannedMinutesFor(userId, d)
      const dayWork  = pt?.duree_minutes || 0

      plannedMonthMin += dayPlan
      if (dateStr <= TODAY) plannedMin += dayPlan
      workedMin  += dayWork
      if (dayPlan > 0 && dateStr <= TODAY) joursAttendus++
      if (pt?.heure_arrivee) joursPointes++
      if (dayPlan > 0 && dayWork === 0 && dateStr <= TODAY) absences++
    })

    // Compte désactivé : on garde uniquement l'aperçu des heures effectuées
    const inactive = user.actif === false
    if (inactive) {
      return { inactive, plannedMin: 0, plannedMonthMin: 0, workedMin, balance: 0, absences: 0,
               tauxActivite: null, congesApprouves: 0, vac: null, joursAttendus: 0, joursPointes }
    }

    const balance      = workedMin - plannedMin
    const tauxActivite = plannedMin > 0 ? Math.round((workedMin / plannedMin) * 100) : null

    const congesApprouves = conges.filter(c =>
      c.user_id === userId &&
      c.statut === 'approuve' &&
      c.date_debut <= to &&
      c.date_fin >= from
    ).length

    const vac = computeVacances(userId, conges, THIS_YEAR)

    return { inactive, plannedMin, plannedMonthMin, workedMin, balance, absences, tauxActivite, congesApprouves, vac, joursAttendus, joursPointes }
  }

  const allStats = collaborateurs
    .map(u => ({ user: u, ...computeStats(u) }))
    .sort((a, b) => Number(a.inactive) - Number(b.inactive)) // comptes désactivés en dernier
  const activeStats = allStats.filter(r => !r.inactive)

  // KPI globaux
  const totalWorkedMin    = activeStats.reduce((s, r) => s + r.workedMin, 0)
  const totalPlannedMin   = activeStats.reduce((s, r) => s + r.plannedMin, 0)
  const totalCongesPending = conges.filter(c => c.statut === 'en_attente').length
  const totalAbsences     = activeStats.reduce((s, r) => s + r.absences, 0)
  const validTaux         = activeStats.filter(r => r.tauxActivite !== null)
  const tauxEquipe        = validTaux.length > 0
    ? Math.round(validTaux.reduce((s, r) => s + r.tauxActivite, 0) / validTaux.length)
    : null

  const exportCSV = () => {
    const headers = ['Nom', 'Rôle', 'Heures attendues', 'Heures faites', 'Écart', 'Taux activité', 'Congés approuvés', 'Jours sans pointage', 'Statut']
    const rows = allStats.map(r => {
      const alerts = []
      if (r.balance < -300) alerts.push('Solde critique')
      if (r.tauxActivite !== null && r.tauxActivite < 80) alerts.push('Taux faible')
      return [
        r.user.name,
        r.user.role === 'manager' ? 'Manager' : r.user.poste || 'Assistante',
        r.inactive ? 'N/A' : minutesToHHMM(r.plannedMin),
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

      <ReglesHeures />

      {/* 3 chiffres clés, en mots simples */}
      <div className="drh-kpi-grid">
        <div className="card drh-kpi">
          <div className="drh-kpi-body">
            <span className="drh-kpi-lbl">Heures faites par l'équipe</span>
            <span className="drh-kpi-val">{minutesToHHMM(totalWorkedMin)}</span>
            <span className="drh-kpi-sub">sur {minutesToHHMM(totalPlannedMin)} attendues jusqu'à aujourd'hui</span>
          </div>
        </div>

        <div className={`card drh-kpi ${totalCongesPending > 0 ? 'drh-kpi-warn' : ''}`}>
          <div className="drh-kpi-body">
            <span className="drh-kpi-lbl">Congés à valider</span>
            <span className="drh-kpi-val">{totalCongesPending}</span>
            <span className="drh-kpi-sub">{totalCongesPending > 0 ? 'demandes en attente de ta réponse' : 'aucune demande en attente'}</span>
          </div>
        </div>

        <div className={`card drh-kpi ${totalAbsences > 5 && totalWorkedMin > 0 ? 'drh-kpi-danger' : ''}`}>
          <div className="drh-kpi-body">
            <span className="drh-kpi-lbl">Jours sans pointage</span>
            <span className="drh-kpi-val">{totalAbsences}</span>
            <span className="drh-kpi-sub">jours de travail où personne n'a pointé (absence ou oubli)</span>
          </div>
        </div>
      </div>

      {/* Une ligne par personne : faites / attendues + situation */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="card drh-table-card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th scope="col">Collaborateur</th>
                  <th scope="col">Heures faites / attendues — {monthLabel}</th>
                  <th scope="col">Situation</th>
                  <th scope="col">Vacances {THIS_YEAR}</th>
                </tr>
              </thead>
              <tbody>
                {allStats.map(r => (
                  <tr key={r.user.id} className={r.inactive ? 'drh-row-inactive' : ''}>
                    <td>
                      <div className="drh-collab">
                        <div className="drh-avatar">{r.user.name[0]}</div>
                        <div>
                          <div className="drh-collab-name">{r.user.name}</div>
                          <div className="drh-collab-role">
                            {r.inactive ? 'Ancien collaborateur' : r.user.role === 'manager' ? 'Manager' : r.user.poste || 'Assistante médicale'}
                          </div>
                        </div>
                      </div>
                    </td>
                    {r.inactive ? (
                      <>
                        <td><div className="sit-figures"><span><strong>{minutesToHHMM(r.workedMin)}</strong> faites</span></div></td>
                        <td><span className="drh-no-pointage">Ne travaille plus au cabinet</span></td>
                        <td><span className="sh-dash">—</span></td>
                      </>
                    ) : (
                      <>
                        <td className="drh-col-progress">
                          <Progression workedMin={r.workedMin} plannedMin={r.plannedMin} joursPointes={r.joursPointes} joursAttendus={r.joursAttendus} />
                        </td>
                        <td><Situation workedMin={r.workedMin} plannedMin={r.plannedMin} /></td>
                        <td>
                          <div className="drh-vac">
                            <span className="drh-vac-restant">{r.vac.restant} jour{r.vac.restant > 1 ? 's' : ''} restant{r.vac.restant > 1 ? 's' : ''}</span>
                            <span className="drh-vac-detail">{r.vac.consomme} pris sur {r.vac.quota}</span>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
