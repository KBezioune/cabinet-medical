import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

const MAX_ATTEMPTS = 5
const LOCKOUT_SECS = 30

export default function Login() {
  const { login } = useAuth()
  const [password, setPassword]   = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [error, setError]         = useState('')
  const [attempts, setAttempts]   = useState(0)
  const [locked, setLocked]       = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading]     = useState(false)
  const timerRef  = useRef(null)
  const inputRef  = useRef(null)

  // Décompte blocage
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
        setPassword('')
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [locked])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!password.trim() || locked || loading) return
    setLoading(true)
    setError('')
    try {
      await login(password)
    } catch {
      const next = attempts + 1
      setAttempts(next)
      setPassword('')
      if (next >= MAX_ATTEMPTS) {
        setLocked(true)
      } else {
        const left = MAX_ATTEMPTS - next
        setError(`Mot de passe incorrect. ${left} tentative${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}.`)
        inputRef.current?.focus()
      }
    } finally {
      setLoading(false)
    }
  }

  const radius = 22
  const circ   = 2 * Math.PI * radius
  const offset = locked ? circ * (1 - countdown / LOCKOUT_SECS) : 0

  return (
    <div className="login-bg">
      <div className="login-orb login-orb-1" aria-hidden="true" />
      <div className="login-orb login-orb-2" aria-hidden="true" />
      <div className="login-orb login-orb-3" aria-hidden="true" />

      <div className="login-card">
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
          /* Écran de blocage */
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
          /* Formulaire */
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <p className="login-subtitle">Identifiez-vous pour accéder au système</p>

            <div className="login-field">
              <label className="login-label" htmlFor="login-pwd">Mot de passe</label>
              <div className="login-input-wrap">
                {/* Icône cadenas */}
                <span className="login-input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>

                <input
                  id="login-pwd"
                  ref={inputRef}
                  type={showPwd ? 'text' : 'password'}
                  className="login-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe"
                  autoComplete="current-password"
                  autoFocus
                  disabled={locked || loading}
                  aria-describedby={error ? 'login-error' : undefined}
                />

                {/* Bouton œil */}
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  tabIndex={-1}
                >
                  {showPwd ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>

              {error && (
                <p id="login-error" className="login-error" role="alert">{error}</p>
              )}
            </div>

            {/* Indicateur de tentatives */}
            {attempts > 0 && (
              <div className="login-attempts">
                {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                  <span key={i} className={`login-attempt-dot ${i < attempts ? 'used' : ''}`} />
                ))}
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={!password.trim() || loading}
            >
              {loading ? (
                <span className="login-spinner" />
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Se connecter
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
