import { Fragment, useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import AllPointages from './AllPointages'
import PlanningTaches from './PlanningTaches'
import MonthlyExport from './MonthlyExport'
import GestionPins from './GestionPins'
import JournauxAcces from './JournauxAcces'
import GestionConges from './GestionConges'
import SoldeHeures from './SoldeHeures'
import DashboardRH from './DashboardRH'
import Annuaire from './Annuaire'
import Statistiques from './Statistiques'
import ClockInOut from '../assistant/ClockInOut'
import PlanningPartage from '../shared/PlanningPartage'
import NotesDefrais from '../shared/NotesDefrais'
import Aide from '../shared/Aide'
import Messages from '../shared/Messages'
import { getUnreadMessageCount } from '../../lib/db'
import './AdminDashboard.css'

// ── Icônes SVG ────────────────────────────────────────────────
const IC = {
  pointage: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  pointages: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  equipe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  planning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>
    </svg>
  ),
  soldes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  conges: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/>
    </svg>
  ),
  export: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  pins: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  logs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  annuaire: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  frais: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  aide: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
}

// ── Onglets avec sections ──────────────────────────────────────
const ALL_TABS = [
  { id: 'pointage',  label: 'Pointage',           roles: ['manager'],           section: null },
  { id: 'pointages', label: 'Pointages',           roles: ['admin'],             section: null },
  { id: 'dashboard', label: 'Dashboard RH',        roles: ['admin'],             section: 'Équipe' },
  { id: 'annuaire',  label: 'Annuaire',            roles: ['admin', 'manager'], section: null },
  { id: 'equipe',    label: 'Planning équipe',     roles: ['admin', 'manager'], section: 'Planning' },
  { id: 'planning',  label: 'Planning tâches',     roles: ['admin', 'manager'], section: null },
  { id: 'soldes',    label: 'Soldes des heures',   roles: ['admin', 'manager'], section: 'RH' },
  { id: 'conges',    label: 'Congés',              roles: ['admin', 'manager'], section: null },
  { id: 'frais',     label: 'Notes de frais',      roles: ['admin', 'manager'], section: null },
  { id: 'messages',  label: 'Messages',            roles: ['admin', 'manager'], section: null },
  { id: 'export',    label: 'Export comptabilité', roles: ['admin'],             section: 'Admin' },
  { id: 'stats',     label: 'Statistiques',        roles: ['admin'],             section: null },
  { id: 'pins',      label: 'Mots de passe',       roles: ['admin'],             section: null },
  { id: 'logs',      label: "Journaux d'accès",    roles: ['admin'],             section: null },
  { id: 'aide',      label: 'Aide & Support',      roles: ['admin', 'manager'], section: null },
]

export default function AdminDashboard() {
  const { user } = useAuth()

  const tabs     = ALL_TABS.filter(t => t.roles.includes(user.role))
  const [tab, setTab] = useState(tabs[0]?.id || 'pointages')
  const [unreadMsg, setUnreadMsg] = useState(0)

  const isAdmin   = user.role === 'admin'
  const pageTitle = isAdmin ? 'Cabinet Médical Dr Bezioune' : `Bonjour, ${user.name}`
  const pageSub   = isAdmin ? 'Bienvenue, Dr. Bezioune' : 'Responsable — Assistante médicale'

  useEffect(() => {
    const fetch = async () => {
      try {
        const n = await getUnreadMessageCount(user.id, isAdmin)
        setUnreadMsg(n)
      } catch {}
    }
    fetch()
    const iv = setInterval(fetch, 30000)
    return () => clearInterval(iv)
  }, [user.id, isAdmin])

  return (
    <div className="admin-layout">

      {/* ── Sidebar desktop ─────────────────────────────────── */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div className="admin-sidebar-brand-text">
            <span className="admin-sidebar-brand-title">KB Medical</span>
            <span className="admin-sidebar-brand-sub">Gestion RH</span>
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          {tabs.map(t => (
            <Fragment key={t.id}>
              {t.section && <div className="admin-sidebar-section">{t.section}</div>}
              <button
                className={`admin-sidebar-item${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="admin-sidebar-icon">{IC[t.id]}</span>
                <span className="admin-sidebar-label">{t.label}</span>
                {t.id === 'messages' && unreadMsg > 0 && (
                  <span className="admin-msg-badge">{unreadMsg > 9 ? '9+' : unreadMsg}</span>
                )}
              </button>
            </Fragment>
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
          {tab === 'annuaire'  && <Annuaire />}
          {tab === 'stats'     && <Statistiques />}
          {tab === 'equipe'    && <PlanningPartage />}
          {tab === 'planning'  && <PlanningTaches />}
          {tab === 'soldes'    && <SoldeHeures />}
          {tab === 'conges'    && <GestionConges />}
          {tab === 'frais'     && <NotesDefrais />}
          {tab === 'messages'  && <Messages onUnreadChange={setUnreadMsg} />}
          {tab === 'export'    && <MonthlyExport />}
          {tab === 'pins'      && <GestionPins />}
          {tab === 'logs'      && <JournauxAcces />}
          {tab === 'aide'      && <Aide />}
        </div>
      </div>

      {/* ── Bottom nav mobile ─────────────────────────────────── */}
      <nav className="admin-bottom-nav" aria-label="Navigation principale">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`admin-bottom-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
            title={t.label}
            aria-label={t.label}
          >
            <span className="admin-bottom-icon" style={{ position: 'relative' }}>
              {IC[t.id]}
              {t.id === 'messages' && unreadMsg > 0 && (
                <span className="admin-msg-badge-dot" />
              )}
            </span>
            {tab === t.id && <span className="admin-bottom-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>

    </div>
  )
}
