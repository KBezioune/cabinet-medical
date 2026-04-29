import { useState } from 'react'
import ClockInOut from './ClockInOut'
import MonPlanningTaches from './MonPlanningTaches'
import MyHistory from './MyHistory'
import DemandeConge from './DemandeConge'
import MonSolde from './MonSolde'
import PlanningPartage from '../shared/PlanningPartage'
import './AssistantDashboard.css'

const TABS = [
  { id: 'clock',    label: 'Pointage',       icon: '⏱️' },
  { id: 'schedule', label: 'Mon Planning',   icon: '📅' },
  { id: 'equipe',   label: 'Planning équipe',icon: '📆' },
  { id: 'solde',    label: 'Mon Solde',      icon: '⏰' },
  { id: 'history',  label: 'Mes Pointages',  icon: '📋' },
  { id: 'conges',   label: 'Congés',         icon: '🌴' },
]

export default function AssistantDashboard() {
  const [tab, setTab] = useState('clock')

  return (
    <div className="assistant-dashboard">

      {/* Nav horizontale — visible sur desktop uniquement */}
      <nav className="tab-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
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

      {/* Bottom nav mobile — icônes seules, position fixe */}
      <nav className="asst-bottom-nav" aria-label="Navigation principale">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`asst-bottom-btn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
            title={t.label}
            aria-label={t.label}
          >
            <span className="asst-bottom-icon">{t.icon}</span>
            {tab === t.id && <span className="asst-bottom-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>

    </div>
  )
}
