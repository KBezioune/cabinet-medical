import { useState, useEffect } from 'react'
import { formatDate, formatDateTime, minutesToHHMM, currentMonthYear } from '../../utils/dateUtils'
import { getUsers } from '../../lib/localData'
import { getPointagesByUserAndMonth, getPlanningForUsers, getAllConges } from '../../lib/db'
import { format, eachDayOfInterval, getDay, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import './MonthlyExport.css'

const timeToMin = (t) => {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const formatEcart = (min) => {
  if (min === 0) return '±0h'
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

export default function MonthlyExport() {
  const { year: cy, month: cm } = currentMonthYear()
  const [year,  setYear]        = useState(cy)
  const [month, setMonth]       = useState(cm)
  const [selectedUser, setSelectedUser] = useState('all')
  const [allRecords,   setAllRecords]   = useState({})
  const [planning,     setPlanning]     = useState([])
  const [conges,       setConges]       = useState([])
  const [loading,      setLoading]      = useState(true)

  const collaborateurs = getUsers().filter(u => u.role !== 'admin')

  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const ids = collaborateurs.map(u => u.id)
      try {
        const [results, pl, cg] = await Promise.all([
          Promise.all(collaborateurs.map(u => getPointagesByUserAndMonth(u.id, from, to))),
          getPlanningForUsers(ids),
          getAllConges(),
        ])
        const byUser = {}
        collaborateurs.forEach((u, i) => { byUser[u.id] = results[i] })
        setAllRecords(byUser)
        setPlanning(pl)
        setConges(cg)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [year, month])

  // Minutes planifiées pour un utilisateur sur un jour précis
  const getDayPlanned = (userId, dateStr) => {
    const date    = parseISO(dateStr)
    const jourSem = getDay(date) === 0 ? 7 : getDay(date)
    const plan    = planning.find(p => p.user_id === userId && p.jour_semaine === jourSem && p.actif)
    return plan ? timeToMin(plan.heure_fin) - timeToMin(plan.heure_debut) : 0
  }

  // Total planifié sur le mois entier pour un utilisateur
  const getMonthPlanned = (userId) => {
    const userPlan = planning.filter(p => p.user_id === userId && p.actif)
    const days     = eachDayOfInterval({ start: new Date(year, month - 1, 1), end: new Date(year, month, 0) })
    return days.reduce((s, d) => {
      const jourSem = getDay(d) === 0 ? 7 : getDay(d)
      const plan    = userPlan.find(p => p.jour_semaine === jourSem)
      return s + (plan ? timeToMin(plan.heure_fin) - timeToMin(plan.heure_debut) : 0)
    }, 0)
  }

  // Statut du congé pour un utilisateur à une date
  const getCongeStatus = (userId, dateStr) => {
    const c = conges.find(c =>
      c.user_id === userId && c.date_debut <= dateStr && c.date_fin >= dateStr
    )
    if (!c) return null
    if (c.statut === 'approuve')   return 'Congé approuvé'
    if (c.statut === 'en_attente') return 'Congé en attente'
    if (c.statut === 'refuse')     return 'Congé refusé'
    return null
  }

  const getSummary = (userId) => {
    const records    = allRecords[userId] || []
    const jours      = records.filter(r => r.heure_arrivee).length
    const totalMin   = records.reduce((s, r) => s + (r.duree_minutes || 0), 0)
    const plannedMin = getMonthPlanned(userId)
    return { jours, totalMin, plannedMin, records }
  }

  // ── Export CSV comptabilité ───────────────────────────────────
  const exportCSV = () => {
    const targets = selectedUser === 'all'
      ? collaborateurs
      : collaborateurs.filter(u => u.id === selectedUser)

    const headers = [
      'Nom', 'Rôle', 'Date', 'Jour',
      'Heure arrivée', 'Heure départ',
      'Durée (HH:MM)', 'Durée (min)',
      'Heures planifiées', 'Écart', 'Statut congé',
    ]
    const rows = [headers]

    targets.forEach(u => {
      const { records, jours, totalMin, plannedMin } = getSummary(u.id)
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))

      sorted.forEach(r => {
        const dayPlan = getDayPlanned(u.id, r.date)
        const ecart   = (r.duree_minutes || 0) - dayPlan
        rows.push([
          u.name,
          u.role === 'manager' ? 'Manager' : 'Assistante',
          r.date,
          format(parseISO(r.date), 'EEEE', { locale: fr }),
          r.heure_arrivee ? format(new Date(r.heure_arrivee), 'HH:mm') : '',
          r.heure_depart  ? format(new Date(r.heure_depart),  'HH:mm') : '',
          minutesToHHMM(r.duree_minutes),
          r.duree_minutes ?? '',
          minutesToHHMM(dayPlan) === '—' ? '0h00' : minutesToHHMM(dayPlan),
          formatEcart(ecart),
          getCongeStatus(u.id, r.date) || '',
        ])
      })

      rows.push([
        `${u.name} — TOTAL`, '', '', '', '', '',
        minutesToHHMM(totalMin), totalMin,
        minutesToHHMM(plannedMin),
        formatEcart(totalMin - plannedMin),
        `${jours} jour${jours > 1 ? 's' : ''} travaillé${jours > 1 ? 's' : ''}`,
      ])
      rows.push([]) // séparateur entre personnes
    })

    const monthSlug = format(new Date(year, month - 1), 'MMMM_yyyy', { locale: fr })
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `export-compta_${monthSlug}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Export PDF (impression) ───────────────────────────────────
  const exportPDF = () => {
    const targets    = selectedUser === 'all' ? collaborateurs : collaborateurs.filter(u => u.id === selectedUser)
    const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: fr })

    const userSections = targets.map(u => {
      const { records, jours, totalMin, plannedMin } = getSummary(u.id)
      const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
      const ecartTotal = totalMin - plannedMin
      const rows = sorted.map(r => {
        const dayPlan = getDayPlanned(u.id, r.date)
        const ecart   = (r.duree_minutes || 0) - dayPlan
        const conge   = getCongeStatus(u.id, r.date)
        return `<tr>
          <td>${formatDate(r.date)}</td>
          <td style="color:#16a34a">${r.heure_arrivee ? format(new Date(r.heure_arrivee), 'HH:mm') : '—'}</td>
          <td style="color:#dc2626">${r.heure_depart  ? format(new Date(r.heure_depart),  'HH:mm') : '—'}</td>
          <td><strong>${minutesToHHMM(r.duree_minutes)}</strong></td>
          <td>${dayPlan > 0 ? minutesToHHMM(dayPlan) : '—'}</td>
          <td style="color:${ecart >= 0 ? '#16a34a' : '#dc2626'}">${dayPlan > 0 ? formatEcart(ecart) : '—'}</td>
          <td style="color:#64748b;font-size:11px">${conge || ''}</td>
        </tr>`
      }).join('')

      return `<div class="user-section">
        <div class="user-header">
          <div class="user-avatar">${u.name[0]}</div>
          <div>
            <div class="user-name">${u.name}</div>
            <div class="user-role">${u.role === 'manager' ? 'Manager' : 'Assistante médicale'}</div>
          </div>
          <div class="user-totals">
            <span class="chip">${jours} jours</span>
            <span class="chip chip-blue">${minutesToHHMM(totalMin)} travaillées</span>
            <span class="chip">${minutesToHHMM(plannedMin)} planifiées</span>
            <span class="chip ${ecartTotal >= 0 ? 'chip-green' : 'chip-red'}">${formatEcart(ecartTotal)}</span>
          </div>
        </div>
        ${records.length === 0
          ? '<p style="color:#94a3b8;padding:1rem 0">Aucun pointage ce mois-ci</p>'
          : `<table>
              <thead><tr><th>Date</th><th>Arrivée</th><th>Départ</th><th>Durée</th><th>Planifié</th><th>Écart</th><th>Congé</th></tr></thead>
              <tbody>
                ${rows}
                <tr class="total-row">
                  <td colspan="3"><strong>TOTAL</strong></td>
                  <td><strong>${minutesToHHMM(totalMin)}</strong></td>
                  <td>${minutesToHHMM(plannedMin)}</td>
                  <td style="color:${ecartTotal >= 0 ? '#16a34a' : '#dc2626'}"><strong>${formatEcart(ecartTotal)}</strong></td>
                  <td>${jours} jour${jours > 1 ? 's' : ''} travaillé${jours > 1 ? 's' : ''}</td>
                </tr>
              </tbody>
            </table>`
        }
      </div>`
    }).join('')

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
      <title>Export comptabilité ${monthLabel}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; padding: 2rem; font-size: 13px; }
        h1 { font-size: 1.375rem; font-weight: 800; color: #0f172a; margin-bottom: 0.25rem; }
        .subtitle { color: #64748b; font-size: 0.875rem; margin-bottom: 2rem; }
        .user-section { margin-bottom: 2.5rem; break-inside: avoid; }
        .user-header { display: flex; align-items: center; gap: 0.875rem; padding: 0.875rem 1rem; background: #f8fafc; border-radius: 0.5rem; margin-bottom: 0.75rem; border: 1px solid #e2e8f0; flex-wrap: wrap; }
        .user-avatar { width: 2.25rem; height: 2.25rem; border-radius: 50%; background: linear-gradient(135deg,#2563eb,#0d9488); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; flex-shrink: 0; }
        .user-name { font-weight: 700; font-size: 1rem; }
        .user-role { font-size: 0.75rem; color: #94a3b8; }
        .user-totals { margin-left: auto; display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .chip { background: #e2e8f0; color: #475569; padding: 0.25rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .chip-green { background: #dcfce7; color: #16a34a; }
        .chip-blue  { background: #dbeafe; color: #1d4ed8; }
        .chip-red   { background: #fee2e2; color: #dc2626; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { padding: 0.5rem 0.75rem; text-align: left; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
        td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; }
        .total-row td { background: #f8fafc; border-top: 2px solid #e2e8f0; }
        .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 0.75rem; }
        @media print { body { padding: 1rem; } }
      </style></head><body>
      <h1>Export comptabilité — ${monthLabel}</h1>
      <p class="subtitle">Centre Médical Dr Bezioune · Généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm')}</p>
      ${userSections}
      <div class="footer">Document généré automatiquement par le système de pointage du Centre Médical Dr Bezioune</div>
      <script>window.onload = () => { window.print() }<\/script>
    </body></html>`

    const w = window.open('', '_blank', 'width=960,height=720')
    w.document.write(html)
    w.document.close()
  }

  const monthLabel     = format(new Date(year, month - 1), 'MMMM yyyy', { locale: fr })
  const displayedUsers = selectedUser === 'all' ? collaborateurs : collaborateurs.filter(u => u.id === selectedUser)

  return (
    <div className="me-wrap">
      {/* Barre de contrôle */}
      <div className="card">
        <div className="export-header">
          <div>
            <h2 className="section-title">Export mensuel — Comptabilité</h2>
            <p className="me-period">{monthLabel}</p>
          </div>
          <div className="export-controls">
            <select value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))}>
              {[cy - 1, cy, cy + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
              <option value="all">Tous les collaborateurs</option>
              {collaborateurs.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className="btn btn-outline" onClick={exportCSV}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              CSV Comptabilité
            </button>
            <button className="btn btn-primary" onClick={exportPDF}>
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              PDF
            </button>
          </div>
        </div>
      </div>

      {loading ? <div className="loading-center"><div className="spinner"/></div> : (
        <>
          {/* Cartes résumé par collaborateur */}
          <div className="summary-cards">
            {displayedUsers.map(u => {
              const { jours, totalMin, plannedMin } = getSummary(u.id)
              const ecart = totalMin - plannedMin
              const taux  = plannedMin > 0 ? Math.round((totalMin / plannedMin) * 100) : null
              return (
                <div key={u.id} className="card user-summary-card">
                  <div className="user-summary-header">
                    <div className="user-avatar">{u.name[0]}</div>
                    <div>
                      <div className="user-summary-name">{u.name}</div>
                      <div className="user-summary-role">{u.role === 'manager' ? 'Manager' : 'Assistante médicale'}</div>
                    </div>
                  </div>
                  <div className="user-summary-stats">
                    <div className="summary-stat">
                      <span className="summary-stat-value">{jours}</span>
                      <span className="summary-stat-label">Jours travaillés</span>
                    </div>
                    <div className="summary-stat">
                      <span className="summary-stat-value blue">{minutesToHHMM(totalMin)}</span>
                      <span className="summary-stat-label">Heures travaillées</span>
                    </div>
                    <div className="summary-stat">
                      <span className="summary-stat-value">{minutesToHHMM(plannedMin)}</span>
                      <span className="summary-stat-label">Heures planifiées</span>
                    </div>
                    <div className="summary-stat">
                      <span className={`summary-stat-value ${ecart >= 0 ? 'green' : 'red'}`}>{formatEcart(ecart)}</span>
                      <span className="summary-stat-label">Écart</span>
                    </div>
                    <div className="summary-stat">
                      <span className={`summary-stat-value ${taux !== null && taux < 80 ? 'red' : ''}`}>
                        {taux !== null ? `${taux}%` : '—'}
                      </span>
                      <span className="summary-stat-label">Taux activité</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tableaux de détail par collaborateur */}
          {displayedUsers.map(u => {
            const { records, jours, totalMin, plannedMin } = getSummary(u.id)
            const sorted      = [...records].sort((a, b) => a.date.localeCompare(b.date))
            const ecartTotal  = totalMin - plannedMin

            return (
              <div key={u.id} className="card">
                <div className="detail-header">
                  <h3>{u.name} — Détail du mois</h3>
                  <div className="me-detail-badges">
                    <span className="badge badge-blue">{jours} jours</span>
                    <span className="badge badge-green">{minutesToHHMM(totalMin)} travaillées</span>
                    <span className={`me-ecart-badge ${ecartTotal >= 0 ? 'ecart-pos' : 'ecart-neg'}`}>
                      {formatEcart(ecartTotal)}
                    </span>
                  </div>
                </div>

                {records.length === 0 ? (
                  <p className="me-empty">Aucun pointage ce mois-ci</p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Arrivée</th>
                          <th>Départ</th>
                          <th>Durée</th>
                          <th>Planifié</th>
                          <th>Écart</th>
                          <th>Congé</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map(r => {
                          const dayPlan = getDayPlanned(u.id, r.date)
                          const ecart   = (r.duree_minutes || 0) - dayPlan
                          const conge   = getCongeStatus(u.id, r.date)
                          return (
                            <tr key={r.id}>
                              <td className="me-date-cell">
                                <span className="me-date">{formatDate(r.date)}</span>
                                <span className="me-dow">{format(parseISO(r.date), 'EEE', { locale: fr })}</span>
                              </td>
                              <td className="me-time me-arrive">{formatDateTime(r.heure_arrivee)}</td>
                              <td className="me-time me-depart">{r.heure_depart ? formatDateTime(r.heure_depart) : '—'}</td>
                              <td>
                                {r.duree_minutes != null
                                  ? <span className="badge badge-blue">{minutesToHHMM(r.duree_minutes)}</span>
                                  : '—'}
                              </td>
                              <td className="me-planned">{dayPlan > 0 ? minutesToHHMM(dayPlan) : <span className="me-dash">—</span>}</td>
                              <td>
                                {dayPlan > 0
                                  ? <span className={`me-ecart-cell ${ecart >= 0 ? 'ecart-pos' : 'ecart-neg'}`}>{formatEcart(ecart)}</span>
                                  : <span className="me-dash">—</span>}
                              </td>
                              <td>
                                {conge
                                  ? <span className={`me-conge-chip ${conge.includes('approuvé') ? 'me-conge-ok' : conge.includes('attente') ? 'me-conge-wait' : 'me-conge-refuse'}`}>{conge}</span>
                                  : <span className="me-dash">—</span>}
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="total-row">
                          <td colSpan={3}><strong>TOTAL</strong></td>
                          <td><span className="badge badge-green">{minutesToHHMM(totalMin)}</span></td>
                          <td className="me-planned"><strong>{minutesToHHMM(plannedMin)}</strong></td>
                          <td>
                            <span className={`me-ecart-cell ${ecartTotal >= 0 ? 'ecart-pos' : 'ecart-neg'}`}>
                              <strong>{formatEcart(ecartTotal)}</strong>
                            </span>
                          </td>
                          <td><span className="me-total-jours">{jours} jours</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {/* Résumé mensuel global — visible uniquement en mode "tous" */}
          {selectedUser === 'all' && (
            <div className="card me-recap">
              <h3 className="me-recap-title">Résumé mensuel — {monthLabel}</h3>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Collaborateur</th>
                      <th>Rôle</th>
                      <th>Jours travaillés</th>
                      <th>Heures planifiées</th>
                      <th>Heures travaillées</th>
                      <th>Écart</th>
                      <th>Taux activité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collaborateurs.map(u => {
                      const { jours, totalMin, plannedMin } = getSummary(u.id)
                      const ecart     = totalMin - plannedMin
                      const taux      = plannedMin > 0 ? Math.round((totalMin / plannedMin) * 100) : null
                      const tauxAlert = taux !== null && taux < 80
                      const soldeCrit = ecart < -300
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="me-collab">
                              <div className="me-avatar">{u.name[0]}</div>
                              <span className="me-collab-name">{u.name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-gray">
                              {u.role === 'manager' ? 'Manager' : 'Assistante'}
                            </span>
                          </td>
                          <td>{jours}</td>
                          <td>{minutesToHHMM(plannedMin)}</td>
                          <td><span className="badge badge-blue">{minutesToHHMM(totalMin)}</span></td>
                          <td>
                            <span className={`me-ecart-cell ${ecart >= 0 ? 'ecart-pos' : 'ecart-neg'}${soldeCrit ? ' me-ecart-crit' : ''}`}>
                              {formatEcart(ecart)}
                            </span>
                          </td>
                          <td>
                            <span className={tauxAlert ? 'me-taux-alert' : 'me-taux-ok'}>
                              {taux !== null ? `${taux}%` : '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="me-recap-note">
                Généré le {format(new Date(), 'dd/MM/yyyy à HH:mm')} · Centre Médical Dr Bezioune
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
