import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import AllPointages from './AllPointages'
import PlanningTaches from './PlanningTaches'
import MonthlyExport from './MonthlyExport'
import GestionPins from './GestionPins'
import GestionConges from './GestionConges'
import SoldeHeures from './SoldeHeures'
import DashboardRH from './DashboardRH'
import ClockInOut from '../assistant/ClockInOut'
import PlanningPartage from '../shared/PlanningPartage'
import './AdminDashboard.css'

const ALL_TABS = [
  { id: 'pointage',  label: 'Pointage',            icon: '⏱️', roles: ['manager'] },
  { id: 'pointages', label: 'Pointages',            icon: '⏱️', roles: ['admin'] },
  { id: 'dashboard', label: 'Dashboard RH',         icon: '👥', roles: ['admin'] },
  { id: 'equipe',    label: 'Planning équipe',      icon: '📆', roles: ['admin', 'manager'] },
  { id: 'planning',  label: 'Planning tâches',      icon: '📅', roles: ['admin', 'manager'] },
  { id: 'soldes',    label: 'Soldes des heures',     icon: '⏰', roles: ['admin', 'manager'] },
  { id: 'conges',    label: 'Congés',               icon: '🌴', roles: ['admin', 'manager'] },
  { id: 'export',    label: 'Export comptabilité',  icon: '📊', roles: ['admin'] },
  { id: 'pins',      label: 'Gestion des PINs',     icon: '🔑', roles: ['admin'] },
]

export default function AdminDashboard() {
  const { user } = useAuth()

  const tabs     = ALL_TABS.filter(t => t.roles.includes(user.role))
  const [tab, setTab] = useState(tabs[0]?.id || 'pointages')

  const isAdmin   = user.role === 'admin'
  const pageTitle = isAdmin ? 'Cabinet Médical Dr Bezioune' : `Bonjour, ${user.name}`
  const pageSub   = isAdmin ? 'Bienvenue, Dr. Bezioune' : 'Responsable — Assistante médicale'

  return (
    <div className="admin-layout">

      {/* ── Sidebar desktop ─────────────────────────────────── */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-logo">🏥</div>
          <div className="admin-sidebar-brand-text">
            <span className="admin-sidebar-brand-title">Cabinet Médical</span>
            <span className="admin-sidebar-brand-sub">Dr Bezioune</span>
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`admin-sidebar-item${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="admin-sidebar-icon">{t.icon}</span>
              <span className="admin-sidebar-label">{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-avatar">{user.name[0]}</div>
          <div className="admin-sidebar-user-info">
            <span className="admin-sidebar-user-name">{user.name}</span>
            <span className="admin-sidebar-user-role">
              {isAdmin ? 'Médecin · Admin' : 'Manager'}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Contenu principal ─────────────────────────────────── */}
      <div className="admin-content">
        <div className="admin-page-header">
          <h1 className="admin-title">{pageTitle}</h1>
          <p className="admin-subtitle">{pageSub}</p>
        </div>

        <div className="tab-content">
          {tab === 'pointage'  && <ClockInOut />}
          {tab === 'pointages' && <AllPointages />}
          {tab === 'dashboard' && <DashboardRH />}
          {tab === 'equipe'    && <PlanningPartage />}
          {tab === 'planning'  && <PlanningTaches />}
          {tab === 'soldes'    && <SoldeHeures />}
          {tab === 'conges'    && <GestionConges />}
          {tab === 'export'    && <MonthlyExport />}
          {tab === 'pins'      && <GestionPins />}
        </div>
      </div>

      {/* ── Bottom nav mobile (fixe, icônes seules) ─────────── */}
      <nav className="admin-bottom-nav" aria-label="Navigation principale">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`admin-bottom-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
            title={t.label}
            aria-label={t.label}
          >
            <span className="admin-bottom-icon">{t.icon}</span>
            {tab === t.id && <span className="admin-bottom-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>

    </div>
  )
}
