import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

export default function Login() {
  const { login } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const loading = false

  const handleDigit = (d) => {
    if (pin.length < 4) setPin(p => p + d)
  }

  const handleDelete = () => setPin(p => p.slice(0, -1))

  const handleSubmit = () => {
    if (pin.length !== 4) return
    setError('')
    try {
      login(pin)
    } catch {
      setError('PIN incorrect. Réessayez.')
      setPin('')
    }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo">
          <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" rx="20" fill="#2563eb"/>
            <text x="50" y="72" fontSize="64" textAnchor="middle" fill="white" fontWeight="bold">+</text>
          </svg>
        </div>
        <h1 className="login-title">Centre Médical Dr Bezioune</h1>
        <p className="login-subtitle">Entrez votre code PIN à 4 chiffres</p>

        <div className="pin-display">
          {[0,1,2,3].map(i => (
            <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
          ))}
        </div>

        {error && <p className="error-msg" style={{ textAlign: 'center' }}>{error}</p>}

        <div className="pin-grid">
          {digits.map((d, i) => (
            <button
              key={i}
              className={`pin-btn ${d === '' ? 'pin-btn-empty' : ''}`}
              onClick={() => {
                if (d === '⌫') handleDelete()
                else if (d !== '') handleDigit(d)
              }}
              disabled={loading || d === ''}
            >
              {d}
            </button>
          ))}
        </div>

        <button
          className="btn btn-primary login-submit"
          onClick={handleSubmit}
          disabled={pin.length !== 4 || loading}
        >
          {loading ? 'Connexion...' : 'Valider'}
        </button>
      </div>
    </div>
  )
}
