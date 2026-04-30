import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Notifications from './shared/Notifications'
import './Layout.css'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">

          <div className="header-brand">
            <div className="header-logo-ring">
              <img src="/logo.png" alt="Logo" className="header-logo-img" />
            </div>
            <div className="header-texts">
              <span className="header-title">Centre Médical Dr Bezioune</span>
              <span className="header-subtitle">Gestion RH &amp; Pointage</span>
            </div>
          </div>

          <div className="header-right">
            <Notifications />

            <div className="header-user">
              <button className="header-btn" onClick={() => setMenuOpen(m => !m)}>
                <div className="header-avatar">{user.name[0]}</div>
                <span className="header-btn-name">{user.name}</span>
                <svg className="header-btn-chevron" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>

              {menuOpen && (
                <div className="dropdown">
                  <div className="dropdown-info">
                    <p className="dropdown-name">{user.name}</p>
                    <p className="dropdown-role">{user.role === 'admin' ? 'Médecin — Administrateur' : 'Assistante médicale'}</p>
                  </div>
                  <button className="dropdown-item" onClick={logout}>
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                    </svg>
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </header>

      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
      <main className="main">{children}</main>
    </div>
  )
}
