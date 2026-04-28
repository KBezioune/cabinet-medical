import { useState } from 'react'
import AllPointages from './AllPointages'
import WeeklyPlanning from './WeeklyPlanning'
import PlanningCalendar from './PlanningCalendar'
import MonthlyExport from './MonthlyExport'
import GestionPins from './GestionPins'
import './AdminDashboard.css'

const TABS = [
  { id: 'pointages', label: 'Pointages en temps réel', icon: '⏱️' },
  { id: 'calendar',  label: 'Calendrier Planning',     icon: '🗓️' },
  { id: 'planning',  label: 'Planning hebdomadaire',   icon: '📅' },
  { id: 'export',    label: 'Export mensuel',           icon: '📊' },
  { id: 'pins',      label: 'Gestion des PINs',         icon: '🔑' },
]

export default function AdminDashboard() {
  const [tab, setTab] = useState('pointages')

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1 className="admin-title">Tableau de bord Administrateur</h1>
        <p className="admin-subtitle">Gestion du personnel médical</p>
      </div>

      <nav className="admin-tab-nav">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`admin-tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {tab === 'pointages' && <AllPointages />}
        {tab === 'calendar'  && <PlanningCalendar />}
        {tab === 'planning'  && <WeeklyPlanning />}
        {tab === 'export'    && <MonthlyExport />}
        {tab === 'pins'      && <GestionPins />}
      </div>
    </div>
  )
}
