import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

const MAX_ATTEMPTS = 3
const LOCKOUT_SECS = 30

export default function Login() {
  const { login } = useAuth()
  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked]     = useState(false)
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef(null)

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
      } else {
        setError(`PIN incorrect. ${MAX_ATTEMPTS - next} tentative${MAX_ATTEMPTS - next > 1 ? 's' : ''} restante${MAX_ATTEMPTS - next > 1 ? 's' : ''}.`)
      }
    }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  const radius = 22
  const circ   = 2 * Math.PI * radius
  const offset = locked ? circ * (1 - countdown / LOCKOUT_SECS) : 0

  return (
    <div className="login-bg">
      {/* Orbes décoratifs */}
      <div className="login-orb login-orb-1" aria-hidden="true" />
      <div className="login-orb login-orb-2" aria-hidden="true" />
      <div className="login-orb login-orb-3" aria-hidden="true" />

      <div className="login-card">
        {/* Accent coloré en haut de la card */}
        <div className="login-card-accent" aria-hidden="true" />

        {/* Logo */}
        <div className="login-logo">
          <img src="/logo.png" alt="KB Medical" className="login-logo-img" />
        </div>

        {/* Titre */}
        <div className="login-brand">
          <h1 className="login-title">KB Medical</h1>
          <p className="login-tagline">Système de Gestion RH</p>
        </div>

        <div className="login-divider" />

        {locked ? (
          <div className="lockout-screen">
            <svg width="60" height="60" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r={radius} fill="none" stroke="var(--gray-100)" strokeWidth="4"/>
              <circle cx="30" cy="30" r={radius} fill="none"
                stroke="var(--red-500)" strokeWidth="4"
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round" transform="rotate(-90 30 30)"
                style={{ transition: 'stroke-dashoffset 0.9s linear' }}
              />
              <text x="30" y="35" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--gray-700)">
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

            {/* Points PIN */}
            <div className="pin-display" role="status" aria-label={`${pin.length} chiffre${pin.length > 1 ? 's' : ''} saisi${pin.length > 1 ? 's' : ''}`}>
              {[0,1,2,3].map(i => (
                <div key={i} className={`pin-dot${pin.length > i ? ' filled' : ''}`} />
              ))}
            </div>

            {error && <p className="login-error">{error}</p>}

            {/* Clavier */}
            <div className="pin-grid">
              {digits.map((d, i) => (
                <button
                  key={i}
                  className={`pin-btn${d === '' ? ' pin-btn-empty' : ''}`}
                  onClick={() => { if (d === '⌫') handleDelete(); else if (d !== '') handleDigit(d) }}
                  disabled={d === ''}
                  aria-label={d === '⌫' ? 'Supprimer' : d === '' ? undefined : d}
                >
                  {d === '⌫' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                      <line x1="18" y1="9" x2="12" y2="15"/>
                      <line x1="12" y1="9" x2="18" y2="15"/>
                    </svg>
                  ) : d}
                </button>
              ))}
            </div>

            <button
              className="login-submit"
              onClick={handleSubmit}
              disabled={pin.length !== 4}
            >
              Se connecter
            </button>
          </>
        )}
      </div>
    </div>
  )
}
