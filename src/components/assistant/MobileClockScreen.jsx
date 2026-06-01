import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { todayISO, formatDateTime, minutesToHHMM, planNetMinutes } from '../../utils/dateUtils'
import {
  getPointageByUserAndDate, insertPointage, updatePointage,
  getPlanningByUser, getPointagesByUserAndMonth, getCongesByUser,
} from '../../lib/db'
import { format, eachDayOfInterval, getDay } from 'date-fns'
import CircularGauge from '../shared/CircularGauge'
import '../shared/CircularGauge.css'
import './MobileClockScreen.css'

const COUNTDOWN  = 5
const CABINET    = { lat: 46.52627, lng: 6.58332 }
const MAX_DIST_M = 200
const VAC_QUOTA = 20
const THIS_YEAR = new Date().getFullYear()

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const verifierPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) { reject(new Error('GPS non disponible.')); return }
  navigator.geolocation.getCurrentPosition(
    pos => resolve(Math.round(haversineDistance(pos.coords.latitude, pos.coords.longitude, CABINET.lat, CABINET.lng))),
    err => reject(new Error({ 1: 'GPS refusé.', 2: 'Position indisponible.', 3: 'Délai GPS dépassé.' }[err.code] || 'Erreur GPS.')),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  )
})

const countWorkDays = (a, b) => {
  const s = new Date(a + 'T12:00:00'); const e = new Date(b + 'T12:00:00')
  if (s > e) return 0
  return eachDayOfInterval({ start: s, end: e }).filter(d => getDay(d) >= 1 && getDay(d) <= 5).length
}

export default function MobileClockScreen() {
  const { user, logout } = useAuth()
  const [now,        setNow]        = useState(new Date())
  const [pointage,   setPointage]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [actionBusy, setActionBusy] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [error,      setError]      = useState(null)
  const [confirmed,  setConfirmed]  = useState(null)
  const [countdown,  setCountdown]  = useState(null)

  const [monthWorked,  setMonthWorked]  = useState(0)
  const [monthPlanned, setMonthPlanned] = useState(0)
  const [vacRestant,   setVacRestant]   = useState(VAC_QUOTA)

  const timerRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => () => clearInterval(timerRef.current), [])

  useEffect(() => {
    const load = async () => {
      const today = todayISO()
      const year  = new Date().getFullYear()
      const month = new Date().getMonth() + 1
      const from  = `${year}-${String(month).padStart(2,'0')}-01`
      const to    = `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`
      try {
        const [pt, pl, pts, cg] = await Promise.all([
          getPointageByUserAndDate(user.id, today),
          getPlanningByUser(user.id),
          getPointagesByUserAndMonth(user.id, from, to),
          getCongesByUser(user.id),
        ])
        setPointage(pt)
        const days = eachDayOfInterval({ start: new Date(year, month-1, 1), end: new Date(year, month, 0) })
        let worked = 0, planned = 0
        days.forEach(d => {
          const ds = format(d, 'yyyy-MM-dd')
          const js = getDay(d) === 0 ? 7 : getDay(d)
          const plan = pl.find(p => p.jour_semaine === js)
          if (plan) planned += planNetMinutes(plan.heure_debut, plan.heure_fin)
          const p = pts.find(x => x.date === ds)
          if (p) worked += p.duree_minutes || 0
        })
        setMonthWorked(worked); setMonthPlanned(planned)
        const y0 = `${year}-01-01`, y1 = `${year}-12-31`
        const consomme = cg
          .filter(c => c.statut === 'approuve' && c.date_debut <= y1 && c.date_fin >= y0)
          .reduce((s, c) => s + countWorkDays(c.date_debut < y0 ? y0 : c.date_debut, c.date_fin > y1 ? y1 : c.date_fin), 0)
        setVacRestant(Math.max(0, VAC_QUOTA - consomme))
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [user.id])

  const startCountdown = (text, isArrivee) => {
    setConfirmed({ text, isArrivee }); setCountdown(COUNTDOWN)
    let rem = COUNTDOWN
    timerRef.current = setInterval(() => {
      rem -= 1; setCountdown(rem)
      if (rem <= 0) { clearInterval(timerRef.current); logout() }
    }, 1000)
  }

  const checkGPS = async () => {
    if (user.role === 'admin' || user.badge === 'Manager · Admin') return true
    setGpsLoading(true); setError(null)
    try {
      const dist = await verifierPosition()
      if (dist > MAX_DIST_M) {
        setError(`📍 Vous êtes à ${dist} m du cabinet. Le pointage est autorisé dans un rayon de ${MAX_DIST_M} m.`)
        return false
      }
      return true
    } catch (e) { setError(`📍 ${e.message}`); return false }
    finally { setGpsLoading(false) }
  }

  const clockIn = async () => {
    if (!await checkGPS()) return
    setActionBusy(true); setError(null)
    try {
      const r = await insertPointage({ user_id: user.id, date: todayISO(), heure_arrivee: new Date().toISOString(), heure_depart: null })
      setPointage(r); startCountdown('Arrivée enregistrée', true)
    } catch (e) { setError(e.message) }
    finally { setActionBusy(false) }
  }

  const clockOut = async () => {
    if (!await checkGPS()) return
    setActionBusy(true); setError(null)
    try {
      const r = await updatePointage(pointage.id, { heure_arrivee: pointage.heure_arrivee, heure_depart: new Date().toISOString() })
      setPointage(r); startCountdown('Départ enregistré', false)
    } catch (e) { setError(e.message) }
    finally { setActionBusy(false) }
  }

  const timeStr   = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const secondStr = String(now.getSeconds()).padStart(2, '0')
  const dateStr   = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const status    = !pointage?.heure_arrivee ? 'absent' : !pointage?.heure_depart ? 'present' : 'done'
  const busy      = actionBusy || gpsLoading

  // ── Écran confirmation ─────────────────────────────────────
  if (confirmed) {
    const R = 30, circ = 2 * Math.PI * R, offset = circ * (1 - countdown / COUNTDOWN)
    return (
      <div className="mob-screen mob-confirm-screen">
        <div className={`mob-confirm-card ${confirmed.isArrivee ? 'mob-card-in' : 'mob-card-out'}`}>
          <div className="mob-confirm-emoji">{confirmed.isArrivee ? '✅' : '👋'}</div>
          <strong className="mob-confirm-title">{confirmed.text} !</strong>
          <span className="mob-confirm-sub">Bonne {confirmed.isArrivee ? 'journée' : 'soirée'}, {user.name}</span>
        </div>
        <svg width="78" height="78" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={R} fill="none" stroke="#e5e7eb" strokeWidth="5"/>
          <circle cx="36" cy="36" r={R} fill="none"
            stroke={confirmed.isArrivee ? '#16a34a' : '#2563eb'}
            strokeWidth="5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset 0.9s linear' }}
          />
          <text x="36" y="41" textAnchor="middle" fontSize="18" fontWeight="700" fill="#374151">{countdown}</text>
        </svg>
        <button className="btn btn-outline mob-logout-btn" onClick={logout}>Déconnecter maintenant</button>
      </div>
    )
  }

  return (
    <div className="mob-screen">

      {/* ── Section haut : heure + date ───────────────────── */}
      <div className="mob-header">
        <div className="mob-greeting">Bonjour, <strong>{user.name}</strong></div>
        <div className="mob-date">{dateStr}</div>
        <div className="mob-clock">
          <span className="mob-clock-hm">{timeStr}</span>
          <span className="mob-clock-sec">{secondStr}</span>
        </div>
      </div>

      {/* ── Statut ────────────────────────────────────────── */}
      <div className={`mob-status mob-status-${status}`}>
        {status === 'absent'  && <><span className="mob-status-dot" />Non pointé aujourd'hui</>}
        {status === 'present' && <><span className="mob-status-dot mob-dot-green" />En service depuis {formatDateTime(pointage.heure_arrivee)}</>}
        {status === 'done'    && <><span className="mob-status-dot mob-dot-blue" />Journée terminée · {minutesToHHMM(pointage?.duree_minutes)}</>}
      </div>

      {/* ── Erreur GPS ────────────────────────────────────── */}
      {error && <div className="mob-error">{error}</div>}

      {/* ── ACTION PRINCIPALE ─────────────────────────────── */}
      <div className="mob-action-zone">
        {status === 'absent' && (
          <button className="mob-action-btn mob-btn-arrive" onClick={clockIn} disabled={busy}>
            {gpsLoading ? (
              <><span className="mob-action-spinner" />Vérification GPS…</>
            ) : actionBusy ? (
              <><span className="mob-action-spinner" />Enregistrement…</>
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Pointer mon arrivée
              </>
            )}
          </button>
        )}

        {status === 'present' && (
          <button className="mob-action-btn mob-btn-depart" onClick={clockOut} disabled={busy}>
            {gpsLoading ? (
              <><span className="mob-action-spinner" />Vérification GPS…</>
            ) : actionBusy ? (
              <><span className="mob-action-spinner" />Enregistrement…</>
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Pointer mon départ
              </>
            )}
          </button>
        )}

        {status === 'done' && (
          <div className="mob-done-card">
            <span className="mob-done-emoji">🎉</span>
            <div>
              <div className="mob-done-title">Bonne fin de journée !</div>
              <div className="mob-done-sub">{minutesToHHMM(pointage?.duree_minutes)} travaillées aujourd'hui</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Jauges ────────────────────────────────────────── */}
      {!loading ? (
        <div className="mob-gauges">
          <div className="mob-gauge-wrap">
            <CircularGauge
              value={Math.round(monthWorked / 60 * 10) / 10}
              max={Math.round(monthPlanned / 60 * 10) / 10 || 1}
              color="#16a34a"
              label="Heures ce mois"
              unit="h"
              size={120}
            />
          </div>
          <div className="mob-gauge-wrap">
            <CircularGauge
              value={vacRestant}
              max={VAC_QUOTA}
              color="#2563eb"
              label="Jours vacances"
              unit="j"
              size={120}
            />
          </div>
        </div>
      ) : (
        <div className="loading-center" style={{ padding: '1.5rem' }}>
          <div className="spinner" />
        </div>
      )}

    </div>
  )
}
