import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

const MAX_ATTEMPTS  = 3
const LOCKOUT_SECS  = 30

export default function Login() {
  const { login } = useAuth()
  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked]     = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef(null)

  // Décompte du blocage
  useEffect(() => {
    if (!locked) return
    setCountdown(LOCKOUT_SECS)
    let remaining = LOCKOUT_SECS
    timerRef.current = setInterval(() => {
      remaining -= 1
      setCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current)
        setLocked(false)
        setAttempts(0)
        setError('')
        setPin('')
      }
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [locked])

  const handleDigit  = (d) => { if (!locked && pin.length < 4) setPin(p => p + d) }
  const handleDelete = () => { if (!locked) setPin(p => p.slice(0, -1)) }

  const handleSubmit = () => {
    if (pin.length !== 4 || locked) return
    setError('')
    try {
      login(pin)
    } catch {
      const next = attempts + 1
      setAttempts(next)
      setPin('')
      if (next >= MAX_ATTEMPTS) {
        setLocked(true)
        setError('')
      } else {
        setError(`PIN incorrect. ${MAX_ATTEMPTS - next} tentative${MAX_ATTEMPTS - next > 1 ? 's' : ''} restante${MAX_ATTEMPTS - next > 1 ? 's' : ''}.`)
      }
    }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  // Anneau SVG du compte à rebours de blocage
  const radius = 22
  const circ   = 2 * Math.PI * radius
  const offset = locked ? circ * (1 - countdown / LOCKOUT_SECS) : 0

  return (
    <div className="login-bg">
      <div className="login-card">

        <div className="login-logo">
          <img src="/logo.png" alt="Centre Médical Dr Bezioune" className="login-logo-img" />
        </div>

        <p className="login-tagline">Système de Pointage</p>
        <h1 className="login-title">Centre Médical<br/>Dr Bezioune</h1>
        <div className="login-divider" />

        {locked ? (
          /* Écran de blocage */
          <div className="lockout-screen">
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r={radius} fill="none" stroke="var(--gray-100)" strokeWidth="4"/>
              <circle cx="28" cy="28" r={radius} fill="none"
                stroke="var(--red-500)" strokeWidth="4"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round" transform="rotate(-90 28 28)"
                style={{ transition: 'stroke-dashoffset 0.9s linear' }}
              />
              <text x="28" y="33" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--gray-700)">
                {countdown}
              </text>
            </svg>
            <div className="lockout-title">Accès temporairement bloqué</div>
            <div className="lockout-subtitle">
              Trop de tentatives incorrectes.<br/>
              Réessayez dans <strong>{countdown} seconde{countdown > 1 ? 's' : ''}</strong>.
            </div>
          </div>
        ) : (
          <>
            <p className="login-subtitle">Entrez votre code PIN à 4 chiffres</p>

            <div className="pin-display">
              {[0,1,2,3].map(i => (
                <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
              ))}
            </div>

            {error && <p className="error-msg" style={{ textAlign: 'center', width: '100%' }}>{error}</p>}

            <div className="pin-grid">
              {digits.map((d, i) => (
                <button
                  key={i}
                  className={`pin-btn ${d === '' ? 'pin-btn-empty' : ''}`}
                  onClick={() => { if (d === '⌫') handleDelete(); else if (d !== '') handleDigit(d) }}
                  disabled={d === ''}
                >
                  {d}
                </button>
              ))}
            </div>

            <button
              className="btn btn-primary login-submit"
              onClick={handleSubmit}
              disabled={pin.length !== 4}
            >
              Connexion
            </button>
          </>
        )}
      </div>
    </div>
  )
}
