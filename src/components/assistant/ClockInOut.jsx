import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { todayISO, formatDateLong, formatDateTime, minutesToHHMM, summarizePointageEvents, pointageStatus } from '../../utils/dateUtils'
import { getPointageEventsByUserAndDate, insertPointageEvent, logAccess } from '../../lib/db'
import './ClockInOut.css'

const COUNTDOWN      = 5
const CABINET        = { lat: 46.52627, lng: 6.58332 }
const MAX_DISTANCE_M = 500

const CONFIRM_CONFIG = {
  arrivee:     { icon: '✅', tone: 'confirm-arrivee', greeting: 'Bonne journée',  text: "Arrivée enregistrée" },
  pause_debut: { icon: '☕', tone: 'confirm-depart',  greeting: 'Bonne pause',    text: 'Pause enregistrée' },
  pause_fin:   { icon: '✅', tone: 'confirm-arrivee', greeting: 'Bon retour',     text: 'Retour de pause enregistré' },
  depart:      { icon: '👋', tone: 'confirm-depart',  greeting: 'Bonne soirée',   text: 'Départ enregistré' },
}

const EVENT_LABELS = {
  arrivee: 'Arrivée', pause_debut: 'Début de pause', pause_fin: 'Fin de pause', depart: 'Départ',
}

// Formule de Haversine — distance en mètres entre deux coordonnées GPS
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R    = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Retourne la distance au cabinet, ou lance une erreur explicite
const verifierPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('GPS non disponible sur cet appareil.'))
    return
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const dist = haversineDistance(
        pos.coords.latitude, pos.coords.longitude,
        CABINET.lat, CABINET.lng
      )
      resolve(Math.round(dist))
    },
    err => {
      const msg = {
        1: 'Accès à la localisation refusé. Autorisez le GPS dans votre navigateur.',
        2: 'Position GPS indisponible. Réessayez.',
        3: 'Délai GPS dépassé. Réessayez.',
      }[err.code] || 'Erreur GPS inconnue.'
      reject(new Error(msg))
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  )
})

export default function ClockInOut() {
  const { user, logout } = useAuth()
  const [events, setEvents]        = useState([])
  const [loading, setLoading]      = useState(true)
  const [actionLoading, setAction] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error, setError]          = useState(null)
  const [now, setNow]              = useState(new Date())
  const [confirmed, setConfirmed]  = useState(null)
  const [countdown, setCountdown]  = useState(null)
  const timerRef = useRef(null)

  const summary = useMemo(() => summarizePointageEvents(events), [events])
  const status  = pointageStatus(summary)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getPointageEventsByUserAndDate(user.id, todayISO())
        setEvents(data)
      } catch (e) {
        setError(`Erreur Supabase: ${e?.code || ''} ${e?.message || 'connexion impossible'}`)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [user.id])

  useEffect(() => () => clearInterval(timerRef.current), [])

  const startCountdown = (kind) => {
    setConfirmed({ kind })
    setCountdown(COUNTDOWN)
    let remaining = COUNTDOWN
    timerRef.current = setInterval(() => {
      remaining -= 1
      setCountdown(remaining)
      if (remaining <= 0) { clearInterval(timerRef.current); logout() }
    }, 1000)
  }

  // Vérifie la position GPS — bypass pour les admins uniquement
  const checkGPS = async () => {
    if (user.role === 'admin') return true
    setGpsLoading(true)
    setError(null)
    try {
      const dist = await verifierPosition()
      if (dist > MAX_DISTANCE_M) {
        setError(`📍 Vous êtes à ${dist} m du cabinet. Le pointage est autorisé dans un rayon de ${MAX_DISTANCE_M} m.`)
        return false
      }
      return true
    } catch (e) {
      setError(`📍 ${e.message}`)
      return false
    } finally {
      setGpsLoading(false)
    }
  }

  const punch = async (type) => {
    const ok = await checkGPS()
    if (!ok) return
    setAction(true); setError(null)
    try {
      const record = await insertPointageEvent(user.id, todayISO(), type)
      setEvents(prev => [...prev, record])
      logAccess({
        userId: user.id, action: `pointage_${type}`, typeEvenement: `pointage_${type}`,
        detail: `${EVENT_LABELS[type]} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        userAgent: navigator.userAgent,
      })
      startCountdown(type)
    } catch (e) {
      setError(`Erreur pointage: ${e?.code || ''} ${e?.message || 'connexion impossible'}`)
    } finally {
      setAction(false)
    }
  }

  const clockIn    = () => punch('arrivee')
  const pauseStart = () => punch('pause_debut')
  const pauseEnd   = () => punch('pause_fin')
  const clockOut   = () => punch('depart')

  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = formatDateLong(now)

  const busy = actionLoading || gpsLoading
  const btnLabel = (label) => gpsLoading ? '📡 Vérification GPS...' : actionLoading ? 'Enregistrement...' : label

  // Écran de confirmation
  if (confirmed) {
    const radius = 28
    const circ   = 2 * Math.PI * radius
    const offset = circ * (1 - countdown / COUNTDOWN)
    const cfg    = CONFIRM_CONFIG[confirmed.kind]
    return (
      <div className="clock-page">
        <div className="card clock-card">
          <div className={`confirm-banner ${cfg.tone}`}>
            <div className="confirm-icon">{cfg.icon}</div>
            <div className="confirm-text">
              <strong>{cfg.text} !</strong>
              <span>{cfg.greeting}, {user.name}</span>
            </div>
          </div>
          <div className="confirm-recap">
            {confirmed.kind === 'arrivee' &&
              <span>Arrivée à <strong>{formatDateTime(summary.heure_arrivee)}</strong></span>}
            {confirmed.kind === 'pause_debut' &&
              <span>Pause depuis <strong>{formatDateTime(summary.pause_debut_courante)}</strong></span>}
            {confirmed.kind === 'pause_fin' &&
              <span>De retour — {summary.pauses.length} pause{summary.pauses.length > 1 ? 's' : ''} prise{summary.pauses.length > 1 ? 's' : ''} ({minutesToHHMM(summary.pause_minutes)})</span>}
            {confirmed.kind === 'depart' &&
              <span>Journée : <strong>{formatDateTime(summary.heure_arrivee)}</strong> → <strong>{formatDateTime(summary.heure_depart)}</strong> · <strong>{minutesToHHMM(summary.duree_minutes)}</strong> travaillées{summary.pauses.length > 0 ? ` (${summary.pauses.length} pause${summary.pauses.length > 1 ? 's' : ''}, ${minutesToHHMM(summary.pause_minutes)})` : ''}</span>}
          </div>
          <div className="countdown-wrapper">
            <svg className="countdown-ring" width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r={radius} fill="none" stroke="var(--gray-100)" strokeWidth="5"/>
              <circle cx="36" cy="36" r={radius} fill="none"
                stroke={cfg.tone === 'confirm-arrivee' ? 'var(--green-500)' : 'var(--brand-500)'}
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
              {status === 'present' && '🟢 En service — arrivée à ' + formatDateTime(summary.heure_arrivee)
                + (summary.pauses.length > 0 ? ` · ${summary.pauses.length} pause${summary.pauses.length > 1 ? 's' : ''}` : '')}
              {status === 'pause'   && '☕ En pause depuis ' + formatDateTime(summary.pause_debut_courante)}
              {status === 'done'    && `✅ Journée terminée · ${minutesToHHMM(summary.duree_minutes)}`}
            </div>

            {error && (
              <div className={error.startsWith('📍') ? 'geo-error' : 'error-msg'}>
                {error}
              </div>
            )}

            {user.role !== 'admin' && (
              <div className="geo-info">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                Le pointage est vérifié par GPS (rayon {MAX_DISTANCE_M} m)
              </div>
            )}

            <div className="clock-actions">
              {status === 'absent' && (
                <button className="btn btn-success clock-big-btn" onClick={clockIn} disabled={busy}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {btnLabel("Pointer l'arrivée")}
                </button>
              )}
              {status === 'present' && (
                <>
                  <button className="btn btn-outline clock-big-btn" onClick={pauseStart} disabled={busy}>
                    ☕ {btnLabel('Partir en pause')}
                  </button>
                  <button className="btn btn-danger clock-big-btn" onClick={clockOut} disabled={busy}>
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    {btnLabel('Terminer la journée')}
                  </button>
                </>
              )}
              {status === 'pause' && (
                <button className="btn btn-success clock-big-btn" onClick={pauseEnd} disabled={busy}>
                  ☕ {btnLabel('Reprendre le travail')}
                </button>
              )}
              {status === 'done' && <div className="done-info"><p>Bonne fin de journée !</p></div>}
            </div>
          </>
        )}
      </div>

      {status !== 'absent' && (
        <div className="card summary-card">
          <h3 className="summary-title">Récapitulatif du jour</h3>
          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Arrivée</span>
              <span className="summary-value green">{formatDateTime(summary.heure_arrivee) || '—'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Départ</span>
              <span className="summary-value red">{formatDateTime(summary.heure_depart) || '—'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Durée nette</span>
              <span className="summary-value blue">{minutesToHHMM(summary.duree_minutes)}</span>
            </div>
          </div>

          {summary.pauses.length > 0 && (
            <div className="pauses-list">
              <span className="summary-label">Pauses ({minutesToHHMM(summary.pause_minutes)} au total)</span>
              <div className="pauses-chips">
                {summary.pauses.map((p, i) => (
                  <span key={i} className="pause-chip">
                    {formatDateTime(p.debut)} → {formatDateTime(p.fin)}
                  </span>
                ))}
                {summary.en_pause && (
                  <span className="pause-chip pause-chip-open">
                    {formatDateTime(summary.pause_debut_courante)} → en cours
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
