import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './Layout.css'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
              <rect width="100" height="100" rx="20" fill="#2563eb"/>
              <text x="50" y="72" fontSize="64" textAnchor="middle" fill="white" fontWeight="bold">+</text>
            </svg>
            <div>
              <span className="header-title">Cabinet Médical</span>
              <span className="header-subtitle">Pointage</span>
            </div>
          </div>

          <div className="header-user">
            <div className={`badge ${user.role === 'admin' ? 'badge-orange' : 'badge-blue'}`}>
              {user.role === 'admin' ? 'Admin' : 'Assistante'}
            </div>
            <button className="btn btn-ghost header-btn" onClick={() => setMenuOpen(m => !m)}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
              </svg>
              <span>{user.name}</span>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            {menuOpen && (
              <div className="dropdown">
                <div className="dropdown-info">
                  <p className="dropdown-name">{user.name}</p>
                  <p className="dropdown-role">{user.role === 'admin' ? 'Médecin Admin' : 'Assistante médicale'}</p>
                </div>
                <hr style={{ borderColor: 'var(--gray-200)' }} />
                <button className="dropdown-item" onClick={logout}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                  </svg>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}

      <main className="main">
        {children}
      </main>
    </div>
  )
}
