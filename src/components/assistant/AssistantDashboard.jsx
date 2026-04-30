import { useState } from 'react'
import ClockInOut from './ClockInOut'
import MonPlanningTaches from './MonPlanningTaches'
import MyHistory from './MyHistory'
import DemandeConge from './DemandeConge'
import MonSolde from './MonSolde'
import PlanningPartage from '../shared/PlanningPartage'
import './AssistantDashboard.css'

// ── Icônes SVG ────────────────────────────────────────────────
const IC = {
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  schedule: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  equipe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  solde: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
  conges: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 12a11.05 11.05 0 0 0-22 0zm-5 7a3 3 0 0 1-6 0v-7"/>
    </svg>
  ),
}

const TABS = [
  { id: 'clock',    label: 'Pointage'       },
  { id: 'schedule', label: 'Mon Planning'   },
  { id: 'equipe',   label: 'Planning équipe'},
  { id: 'solde',    label: 'Mon Solde'      },
  { id: 'history',  label: 'Mes Pointages'  },
  { id: 'conges',   label: 'Congés'         },
]

export default function AssistantDashboard() {
  const [tab, setTab] = useState('clock')

  return (
    <div className="assistant-dashboard">

      {/* Nav horizontale desktop */}
      <nav className="tab-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{IC[t.id]}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Contenu */}
      <div className="tab-content">
        {tab === 'clock'    && <ClockInOut />}
        {tab === 'schedule' && <MonPlanningTaches />}
        {tab === 'equipe'   && <PlanningPartage />}
        {tab === 'solde'    && <MonSolde />}
        {tab === 'history'  && <MyHistory />}
        {tab === 'conges'   && <DemandeConge />}
      </div>

      {/* Bottom nav mobile */}
      <nav className="asst-bottom-nav" aria-label="Navigation principale">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`asst-bottom-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
            title={t.label}
            aria-label={t.label}
          >
            <span className="asst-bottom-icon">{IC[t.id]}</span>
            {tab === t.id && <span className="asst-bottom-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>

    </div>
  )
}
