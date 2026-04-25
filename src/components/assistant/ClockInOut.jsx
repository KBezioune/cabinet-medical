import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { todayISO, formatDateLong, formatDateTime, minutesToHHMM } from '../../utils/dateUtils'
import { getPointageByUserAndDate, insertPointage, updatePointage } from '../../lib/localData'
import './ClockInOut.css'

export default function ClockInOut() {
  const { user } = useAuth()
  const [pointage, setPointage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const today = todayISO()
    setPointage(getPointageByUserAndDate(user.id, today))
    setLoading(false)
  }, [user.id])

  const clockIn = () => {
    setMsg(null)
    const record = insertPointage({
      user_id: user.id,
      date: todayISO(),
      heure_arrivee: new Date().toISOString(),
      heure_depart: null,
    })
    setPointage(record)
    setMsg({ type: 'success', text: 'Arrivée enregistrée !' })
  }

  const clockOut = () => {
    setMsg(null)
    const updated = updatePointage(pointage.id, {
      heure_arrivee: pointage.heure_arrivee,
      heure_depart: new Date().toISOString(),
    })
    setPointage(updated)
    setMsg({ type: 'success', text: 'Départ enregistré !' })
  }

  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = formatDateLong(now)

  const status = !pointage?.heure_arrivee ? 'absent'
    : !pointage?.heure_depart ? 'present'
    : 'done'

  return (
    <div className="clock-page">
      <div className="card clock-card">
        <div className="clock-display">
          <div className="clock-time">{timeStr}</div>
          <div className="clock-date">{dateStr}</div>
        </div>

        <div className="clock-greeting">
          <h2>Bonjour, <strong>{user.name}</strong> !</h2>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <>
            <div className={`status-banner status-${status}`}>
              {status === 'absent'  && "🔴 Non pointé aujourd'hui"}
              {status === 'present' && '🟢 En service — arrivée à ' + formatDateTime(pointage.heure_arrivee)}
              {status === 'done'    && '✅ Journée terminée'}
            </div>

            {msg && <div className={msg.type === 'error' ? 'error-msg' : 'success-msg'}>{msg.text}</div>}

            <div className="clock-actions">
              {status === 'absent' && (
                <button className="btn btn-success clock-big-btn" onClick={clockIn}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Pointer mon arrivée
                </button>
              )}
              {status === 'present' && (
                <button className="btn btn-danger clock-big-btn" onClick={clockOut}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Pointer mon départ
                </button>
              )}
              {status === 'done' && <div className="done-info"><p>Bonne fin de journée !</p></div>}
            </div>
          </>
        )}
      </div>

      {pointage && (
        <div className="card summary-card">
          <h3 className="summary-title">Récapitulatif du jour</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Arrivée</span>
              <span className="summary-value green">{formatDateTime(pointage.heure_arrivee) || '—'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Départ</span>
              <span className="summary-value red">{formatDateTime(pointage.heure_depart) || '—'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Durée</span>
              <span className="summary-value blue">{minutesToHHMM(pointage.duree_minutes)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
