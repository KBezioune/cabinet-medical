import { useState, useEffect } from 'react'
import { formatDate, formatDateTime, minutesToHHMM, currentMonthYear } from '../../utils/dateUtils'
import { getAssistants } from '../../lib/localData'
import { getPointagesByUserAndMonth } from '../../lib/db'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import './MonthlyExport.css'

export default function MonthlyExport() {
  const { year: cy, month: cm } = currentMonthYear()
  const [year,  setYear]        = useState(cy)
  const [month, setMonth]       = useState(cm)
  const [selectedUser, setSelectedUser] = useState('all')
  const [allRecords, setAllRecords]     = useState({})
  const [loading, setLoading]           = useState(true)

  const assistants = getAssistants()

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const from = `${year}-${String(month).padStart(2,'0')}-01`
      const to   = `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`
      try {
        const results = await Promise.all(assistants.map(u => getPointagesByUserAndMonth(u.id, from, to)))
        const byUser = {}
        assistants.forEach((u, i) => { byUser[u.id] = results[i] })
        setAllRecords(byUser)
      } catch { /* silencieux */ }
      finally { setLoading(false) }
    }
    fetch()
  }, [year, month])

  const getSummary = (userId) => {
    const records  = allRecords[userId] || []
    const jours    = records.filter(r => r.heure_arrivee).length
    const totalMin = records.reduce((s, r) => s + (r.duree_minutes || 0), 0)
    return { jours, totalMin, records }
  }

  const exportPDF = () => {
    const targets = selectedUser === 'all' ? assistants : assistants.filter(u => u.id === selectedUser)
    const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: fr })

    const userSections = targets.map(u => {
      const { records, jours, totalMin } = getSummary(u.id)
      const rows = records.map(r => `
        <tr>
          <td>${formatDate(r.date)}</td>
          <td style="color:#16a34a">${r.heure_arrivee ? format(new Date(r.heure_arrivee),'HH:mm') : '—'}</td>
          <td style="color:#dc2626">${r.heure_depart  ? format(new Date(r.heure_depart), 'HH:mm') : '—'}</td>
          <td><strong>${minutesToHHMM(r.duree_minutes)}</strong></td>
          <td style="color:#64748b">${r.note || ''}</td>
        </tr>`).join('')
      return `
        <div class="user-section">
          <div class="user-header">
            <div class="user-avatar">${u.name[0]}</div>
            <div>
              <div class="user-name">${u.name}</div>
              <div class="user-role">Assistante médicale</div>
            </div>
            <div class="user-totals">
              <span class="chip">${jours} jours</span>
              <span class="chip chip-green">${minutesToHHMM(totalMin)}</span>
              <span class="chip">${jours > 0 ? minutesToHHMM(Math.round(totalMin/jours)) : '—'} / jour</span>
            </div>
          </div>
          ${records.length === 0
            ? '<p style="color:#94a3b8;padding:1rem 0">Aucun pointage ce mois-ci</p>'
            : `<table>
                <thead><tr><th>Date</th><th>Arrivée</th><th>Départ</th><th>Durée</th><th>Note</th></tr></thead>
                <tbody>
                  ${rows}
                  <tr class="total-row">
                    <td colspan="3"><strong>TOTAL</strong></td>
                    <td><strong>${minutesToHHMM(totalMin)}</strong></td>
                    <td>${jours} jour${jours > 1 ? 's' : ''} travaillé${jours > 1 ? 's' : ''}</td>
                  </tr>
                </tbody>
              </table>`
          }
        </div>`
    }).join('')

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
      <title>Pointages ${monthLabel}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; padding: 2rem; font-size: 13px; }
        h1 { font-size: 1.375rem; font-weight: 800; color: #0f172a; margin-bottom: 0.25rem; }
        .subtitle { color: #64748b; font-size: 0.875rem; margin-bottom: 2rem; }
        .user-section { margin-bottom: 2.5rem; break-inside: avoid; }
        .user-header { display: flex; align-items: center; gap: 0.875rem; padding: 0.875rem 1rem; background: #f8fafc; border-radius: 0.5rem; margin-bottom: 0.75rem; border: 1px solid #e2e8f0; }
        .user-avatar { width: 2.25rem; height: 2.25rem; border-radius: 50%; background: linear-gradient(135deg,#2563eb,#0d9488); color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; flex-shrink: 0; }
        .user-name { font-weight: 700; font-size: 1rem; }
        .user-role { font-size: 0.75rem; color: #94a3b8; }
        .user-totals { margin-left: auto; display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .chip { background: #e2e8f0; color: #475569; padding: 0.25rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .chip-green { background: #dcfce7; color: #16a34a; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { padding: 0.5rem 0.75rem; text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
        td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; }
        .total-row td { background: #f8fafc; font-weight: 600; border-top: 2px solid #e2e8f0; }
        .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 0.75rem; }
        @media print { body { padding: 1rem; } }
      </style></head><body>
      <h1>Récapitulatif mensuel — ${monthLabel}</h1>
      <p class="subtitle">Centre Médical Dr Bezioune · Généré le ${format(new Date(),'dd/MM/yyyy à HH:mm')}</p>
      ${userSections}
      <div class="footer">Document généré automatiquement par le système de pointage du Centre Médical Dr Bezioune</div>
      <script>window.onload = () => { window.print() }<\/script>
    </body></html>`

    const w = window.open('', '_blank', 'width=900,height=700')
    w.document.write(html)
    w.document.close()
  }

  const exportCSV = () => {
    const rows = [['Assistante','Date','Arrivée','Départ','Durée (min)','Durée (HH:MM)','Note']]
    const targets = selectedUser === 'all' ? assistants : assistants.filter(u => u.id === selectedUser)
    targets.forEach(u => {
      const { records, jours, totalMin } = getSummary(u.id)
      records.forEach(r => rows.push([
        u.name, r.date,
        r.heure_arrivee ? format(new Date(r.heure_arrivee), 'HH:mm') : '',
        r.heure_depart  ? format(new Date(r.heure_depart),  'HH:mm') : '',
        r.duree_minutes ?? '', minutesToHHMM(r.duree_minutes), r.note || '',
      ]))
      rows.push([u.name + ' — TOTAL','','','', totalMin, minutesToHHMM(totalMin), `${jours} jours travaillés`])
      rows.push([])
    })
    const monthLabel = format(new Date(year, month - 1), 'MMMM_yyyy', { locale: fr })
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `pointages_${monthLabel}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const monthOptions  = Array.from({ length: 12 }, (_, i) => ({ value: i+1, label: format(new Date(2024,i,1),'MMMM',{locale:fr}) }))
  const displayedUsers = selectedUser === 'all' ? assistants : assistants.filter(u => u.id === selectedUser)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card">
        <div className="export-header">
          <h2 className="section-title">Export mensuel — Récapitulatif paye</h2>
          <div className="export-controls">
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width:'auto' }}>
              {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width:'auto' }}>
              {[cy-1, cy, cy+1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={{ width:'auto' }}>
              <option value="all">Toutes</option>
              {assistants.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className="btn btn-outline" onClick={exportCSV}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              CSV
            </button>
            <button className="btn btn-primary" onClick={exportPDF}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              PDF
            </button>
          </div>
        </div>
      </div>

      {loading ? <div className="loading-center"><div className="spinner"/></div> : (
        <>
          <div className="summary-cards">
            {displayedUsers.map(u => {
              const { jours, totalMin } = getSummary(u.id)
              return (
                <div key={u.id} className="card user-summary-card">
                  <div className="user-summary-header">
                    <div className="user-avatar">{u.name[0]}</div>
                    <div>
                      <div className="user-summary-name">{u.name}</div>
                      <div className="user-summary-role">Assistante médicale</div>
                    </div>
                  </div>
                  <div className="user-summary-stats">
                    <div className="summary-stat">
                      <span className="summary-stat-value">{jours}</span>
                      <span className="summary-stat-label">Jours travaillés</span>
                    </div>
                    <div className="summary-stat">
                      <span className="summary-stat-value blue">{minutesToHHMM(totalMin)}</span>
                      <span className="summary-stat-label">Heures totales</span>
                    </div>
                    <div className="summary-stat">
                      <span className="summary-stat-value">{jours > 0 ? minutesToHHMM(Math.round(totalMin/jours)) : '—'}</span>
                      <span className="summary-stat-label">Moy. par jour</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {displayedUsers.map(u => {
            const { records, jours, totalMin } = getSummary(u.id)
            return (
              <div key={u.id} className="card">
                <div className="detail-header">
                  <h3>{u.name} — Détail du mois</h3>
                  <div style={{ display:'flex', gap:'0.5rem' }}>
                    <span className="badge badge-blue">{jours} jours</span>
                    <span className="badge badge-green">{minutesToHHMM(totalMin)}</span>
                  </div>
                </div>
                {records.length === 0 ? (
                  <p style={{ color:'var(--gray-400)', fontSize:'0.875rem', padding:'1rem 0' }}>Aucun pointage ce mois-ci</p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Date</th><th>Arrivée</th><th>Départ</th><th>Durée</th><th>Note</th></tr></thead>
                      <tbody>
                        {records.map(r => (
                          <tr key={r.id}>
                            <td>{formatDate(r.date)}</td>
                            <td style={{ color:'var(--green-600)', fontWeight:500 }}>{formatDateTime(r.heure_arrivee)}</td>
                            <td style={{ color:'var(--red-600)',   fontWeight:500 }}>{r.heure_depart ? formatDateTime(r.heure_depart) : '—'}</td>
                            <td>{r.duree_minutes != null ? <span className="badge badge-blue">{minutesToHHMM(r.duree_minutes)}</span> : '—'}</td>
                            <td style={{ color:'var(--gray-500)', fontSize:'0.8125rem' }}>{r.note || '—'}</td>
                          </tr>
                        ))}
                        <tr className="total-row">
                          <td colSpan={3}><strong>TOTAL</strong></td>
                          <td><span className="badge badge-green">{minutesToHHMM(totalMin)}</span></td>
                          <td><span style={{ fontSize:'0.8125rem', color:'var(--gray-500)' }}>{jours} jours</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
