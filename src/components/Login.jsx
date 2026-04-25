import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

export default function Login() {
  const { login } = useAuth()
  const [pin, setPin]   = useState('')
  const [error, setError] = useState('')

  const handleDigit = (d) => { if (pin.length < 4) setPin(p => p + d) }
  const handleDelete = () => setPin(p => p.slice(0, -1))

  const handleSubmit = () => {
    if (pin.length !== 4) return
    setError('')
    try { login(pin) }
    catch { setError('PIN incorrect. Réessayez.'); setPin('') }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="login-bg">
      <div className="login-card">

        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-ring">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
        </div>

        <p className="login-tagline">Système de Pointage</p>
        <h1 className="login-title">Centre Médical<br/>Dr Bezioune</h1>

        <div className="login-divider" />

        <p className="login-subtitle">Entrez votre code PIN à 4 chiffres</p>

        {/* Indicateur PIN */}
        <div className="pin-display">
          {[0,1,2,3].map(i => (
            <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
          ))}
        </div>

        {error && <p className="error-msg" style={{ textAlign: 'center', width: '100%' }}>{error}</p>}

        {/* Clavier */}
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
      </div>
    </div>
  )
}
