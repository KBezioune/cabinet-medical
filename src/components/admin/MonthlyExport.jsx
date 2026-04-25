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
            <button className="btn btn-primary" onClick={exportCSV}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Exporter CSV
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
