import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { todayISO, formatDateLong, formatDateTime, minutesToHHMM } from '../../utils/dateUtils'
import { getPointageByUserAndDate, insertPointage, updatePointage } from '../../lib/db'
import './ClockInOut.css'

const COUNTDOWN = 5

export default function ClockInOut() {
  const { user, logout } = useAuth()
  const [pointage, setPointage]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [actionLoading, setAction]  = useState(false)
  const [error, setError]           = useState(null)
  const [now, setNow]               = useState(new Date())
  const [confirmed, setConfirmed]   = useState(null)
  const [countdown, setCountdown]   = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getPointageByUserAndDate(user.id, todayISO())
        setPointage(data)
      } catch (e) {
        setError('Impossible de charger les données. Vérifiez la connexion.')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [user.id])

  useEffect(() => () => clearInterval(timerRef.current), [])

  const startCountdown = (text, isArrivee) => {
    setConfirmed({ text, isArrivee })
    setCountdown(COUNTDOWN)
    let remaining = COUNTDOWN
    timerRef.current = setInterval(() => {
      remaining -= 1
      setCountdown(remaining)
      if (remaining <= 0) { clearInterval(timerRef.current); logout() }
    }, 1000)
  }

  const clockIn = async () => {
    setAction(true); setError(null)
    try {
      const record = await insertPointage({
        user_id: user.id,
        date: todayISO(),
        heure_arrivee: new Date().toISOString(),
        heure_depart: null,
      })
      setPointage(record)
      startCountdown('Arrivée enregistrée', true)
    } catch {
      setError('Erreur lors du pointage. Réessayez.')
    } finally {
      setAction(false)
    }
  }

  const clockOut = async () => {
    setAction(true); setError(null)
    try {
      const updated = await updatePointage(pointage.id, {
        heure_arrivee: pointage.heure_arrivee,
        heure_depart: new Date().toISOString(),
      })
      setPointage(updated)
      startCountdown('Départ enregistré', false)
    } catch {
      setError('Erreur lors du pointage. Réessayez.')
    } finally {
      setAction(false)
    }
  }

  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = formatDateLong(now)
  const status  = !pointage?.heure_arrivee ? 'absent'
    : !pointage?.heure_depart ? 'present'
    : 'done'

  if (confirmed) {
    const radius = 28
    const circ   = 2 * Math.PI * radius
    const offset = circ * (1 - countdown / COUNTDOWN)
    return (
      <div className="clock-page">
        <div className="card clock-card">
          <div className={`confirm-banner ${confirmed.isArrivee ? 'confirm-arrivee' : 'confirm-depart'}`}>
            <div className="confirm-icon">{confirmed.isArrivee ? '✅' : '👋'}</div>
            <div className="confirm-text">
              <strong>{confirmed.text} !</strong>
              <span>Bonne {confirmed.isArrivee ? 'journée' : 'soirée'}, {user.name}</span>
            </div>
          </div>
          {pointage && (
            <div className="confirm-recap">
              {confirmed.isArrivee
                ? <span>Arrivée à <strong>{formatDateTime(pointage.heure_arrivee)}</strong></span>
                : <span>Journée : <strong>{formatDateTime(pointage.heure_arrivee)}</strong> → <strong>{formatDateTime(pointage.heure_depart)}</strong> · <strong>{minutesToHHMM(pointage.duree_minutes)}</strong></span>
              }
            </div>
          )}
          <div className="countdown-wrapper">
            <svg className="countdown-ring" width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r={radius} fill="none" stroke="var(--gray-100)" strokeWidth="5"/>
              <circle cx="36" cy="36" r={radius} fill="none"
                stroke={confirmed.isArrivee ? 'var(--green-500)' : 'var(--brand-500)'}
                strokeWidth="5" strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round" transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dashoffset 0.9s linear' }}
              />
              <text x="36" y="41" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--gray-700)">{countdown}</text>
            </svg>
            <span className="countdown-label">Déconnexion dans {countdown}s</span>
          </div>
          <button className="btn btn-outline countdown-cancel" onClick={logout}>Déconnecter maintenant</button>
        </div>
      </div>
    )
  }

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
          <div className="loading-center"><div className="spinner"/></div>
        ) : (
          <>
            <div className={`status-banner status-${status}`}>
              {status === 'absent'  && "🔴 Non pointé aujourd'hui"}
              {status === 'present' && '🟢 En service — arrivée à ' + formatDateTime(pointage.heure_arrivee)}
              {status === 'done'    && '✅ Journée terminée'}
            </div>
            {error && <div className="error-msg">{error}</div>}
            <div className="clock-actions">
              {status === 'absent' && (
                <button className="btn btn-success clock-big-btn" onClick={clockIn} disabled={actionLoading}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {actionLoading ? 'Enregistrement...' : 'Pointer mon arrivée'}
                </button>
              )}
              {status === 'present' && (
                <button className="btn btn-danger clock-big-btn" onClick={clockOut} disabled={actionLoading}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {actionLoading ? 'Enregistrement...' : 'Pointer mon départ'}
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
