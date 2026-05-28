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

const COUNTDOWN = 5
const CABINET   = { lat: 46.52627, lng: 6.58332 }
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

const timeToMin = t => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m }

const countWorkDays = (a, b) => {
  const s = new Date(a + 'T12:00:00'); const e = new Date(b + 'T12:00:00')
  if (s > e) return 0
  return eachDayOfInterval({ start: s, end: e }).filter(d => getDay(d) >= 1 && getDay(d) <= 5).length
}

export default function MobileClockScreen() {
  const { user, logout } = useAuth()
  const [now,       setNow]       = useState(new Date())
  const [pointage,  setPointage]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [actionBusy,setActionBusy]= useState(false)
  const [gpsLoading,setGpsLoading]= useState(false)
  const [error,     setError]     = useState(null)
  const [confirmed, setConfirmed] = useState(null)
  const [countdown, setCountdown] = useState(null)

  // Gauge data
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

        // Calcul heures mois
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

        // Calcul vacances
        const y0 = `${year}-01-01`; const y1 = `${year}-12-31`
        const consomme = cg
          .filter(c => c.statut === 'approuve' && c.date_debut <= y1 && c.date_fin >= y0)
          .reduce((s, c) => s + countWorkDays(
            c.date_debut < y0 ? y0 : c.date_debut,
            c.date_fin   > y1 ? y1 : c.date_fin
          ), 0)
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
    if (user.role === 'admin') return true
    setGpsLoading(true); setError(null)
    try {
      const dist = await verifierPosition()
      if (dist > 300) { setError(`📍 Trop loin du cabinet (${dist} m).`); return false }
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

  const timeStr  = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const secondStr= String(now.getSeconds()).padStart(2, '0')
  const dateStr  = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const status   = !pointage?.heure_arrivee ? 'absent' : !pointage?.heure_depart ? 'present' : 'done'
  const busy     = actionBusy || gpsLoading

  // Écran confirmation
  if (confirmed) {
    const R = 28, circ = 2 * Math.PI * R, offset = circ * (1 - countdown / COUNTDOWN)
    return (
      <div className="mob-screen mob-confirm">
        <div className={`mob-confirm-banner ${confirmed.isArrivee ? 'mob-confirm-in' : 'mob-confirm-out'}`}>
          <div className="mob-confirm-icon">{confirmed.isArrivee ? '✅' : '👋'}</div>
          <strong>{confirmed.text} !</strong>
          <span>Bonne {confirmed.isArrivee ? 'journée' : 'soirée'}, {user.name}</span>
        </div>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={R} fill="none" stroke="var(--gray-100)" strokeWidth="5"/>
          <circle cx="36" cy="36" r={R} fill="none"
            stroke={confirmed.isArrivee ? 'var(--green-500)' : 'var(--brand-500)'}
            strokeWidth="5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            transform="rotate(-90 36 36)" style={{ transition: 'stroke-dashoffset 0.9s linear' }}
          />
          <text x="36" y="41" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--gray-700)">{countdown}</text>
        </svg>
        <button className="btn btn-outline" onClick={logout}>Déconnecter maintenant</button>
      </div>
    )
  }

  return (
    <div className="mob-screen">
      {/* Heure */}
      <div className="mob-time-block">
        <div className="mob-time">
          <span className="mob-time-hm">{timeStr}</span>
          <span className="mob-time-sec">{secondStr}</span>
        </div>
        <div className="mob-date">{dateStr}</div>
        <div className="mob-greeting">Bonjour, <strong>{user.name}</strong></div>
      </div>

      {/* Statut */}
      <div className={`mob-status mob-status-${status}`}>
        {status === 'absent'  && "Non pointé aujourd'hui"}
        {status === 'present' && `En service depuis ${formatDateTime(pointage.heure_arrivee)}`}
        {status === 'done'    && `Journée terminée · ${minutesToHHMM(pointage?.duree_minutes)}`}
      </div>

      {/* Jauges */}
      {!loading && (
        <div className="mob-gauges">
          <CircularGauge
            value={Math.round(monthWorked / 60 * 10) / 10}
            max={Math.round(monthPlanned / 60 * 10) / 10 || 1}
            color="var(--green-500)"
            label="Heures ce mois"
            unit="h"
            size={130}
          />
          <CircularGauge
            value={vacRestant}
            max={VAC_QUOTA}
            color="#3b82f6"
            label="Jours de vacances"
            unit="j"
            size={130}
          />
        </div>
      )}
      {loading && <div className="loading-center"><div className="spinner" /></div>}

      {/* Erreur */}
      {error && <div className="mob-error">{error}</div>}

      {/* Boutons d'action en bas */}
      <div className="mob-actions">
        {status === 'absent' && (
          <button className="mob-btn mob-btn-in" onClick={clockIn} disabled={busy}>
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {gpsLoading ? 'GPS…' : actionBusy ? 'Enregistrement…' : 'Arrivée'}
          </button>
        )}
        {status === 'present' && (
          <button className="mob-btn mob-btn-out" onClick={clockOut} disabled={busy}>
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {gpsLoading ? 'GPS…' : actionBusy ? 'Enregistrement…' : 'Départ'}
          </button>
        )}
        {status === 'done' && (
          <div className="mob-done">
            <span>🎉</span>
            <span>Bonne fin de journée !</span>
          </div>
        )}
      </div>
    </div>
  )
}
