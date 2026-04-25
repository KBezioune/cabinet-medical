import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate, formatDateTime, minutesToHHMM, currentMonthYear } from '../../utils/dateUtils'
import { getPointagesByUserAndMonth } from '../../lib/localData'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function MyHistory() {
  const { user } = useAuth()
  const { year: cy, month: cm } = currentMonthYear()
  const [year, setYear]     = useState(cy)
  const [month, setMonth]   = useState(cm)
  const [records, setRecords] = useState([])

  useEffect(() => {
    const from = `${year}-${String(month).padStart(2,'0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const to = `${year}-${String(month).padStart(2,'0')}-${lastDay}`
    setRecords(getPointagesByUserAndMonth(user.id, from, to))
  }, [year, month, user.id])

  const totalMinutes = records.reduce((s, r) => s + (r.duree_minutes || 0), 0)

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: format(new Date(2024, i, 1), 'MMMM', { locale: fr }),
  }))

  return (
    <div className="card">
      <div className="schedule-header">
        <h2 className="section-title">Mes Pointages</h2>
        <div className="week-nav">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 'auto' }}>
            {monthOptions.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 'auto' }}>
            {[cy - 1, cy, cy + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <span className="badge badge-blue">
          Total : {minutesToHHMM(totalMinutes)} sur {records.filter(r => r.heure_arrivee).length} jours
        </span>
      </div>

      {records.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '2rem' }}>
          Aucun pointage pour cette période
        </p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Arrivée</th>
                <th>Départ</th>
                <th>Durée</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>{formatDate(r.date)}</td>
                  <td><span style={{ color: 'var(--green-600)', fontWeight: 500 }}>{formatDateTime(r.heure_arrivee)}</span></td>
                  <td>
                    <span style={{ color: r.heure_depart ? 'var(--red-600)' : 'var(--orange-500)', fontWeight: 500 }}>
                      {r.heure_depart ? formatDateTime(r.heure_depart) : 'En cours...'}
                    </span>
                  </td>
                  <td><span className="badge badge-blue">{minutesToHHMM(r.duree_minutes)}</span></td>
                  <td style={{ color: 'var(--gray-500)', fontSize: '0.8125rem' }}>{r.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
