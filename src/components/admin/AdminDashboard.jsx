import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import AllPointages from './AllPointages'
import PlanningTaches from './PlanningTaches'
import MonthlyExport from './MonthlyExport'
import GestionPins from './GestionPins'
import GestionConges from './GestionConges'
import SoldeHeures from './SoldeHeures'
import './AdminDashboard.css'

// Onglets visibles selon le rôle
const ALL_TABS = [
  { id: 'pointages', label: 'Pointages en temps réel', icon: '⏱️', roles: ['admin'] },
  { id: 'planning',  label: 'Planning hebdomadaire',   icon: '📅', roles: ['admin', 'manager'] },
  { id: 'soldes',    label: 'Soldes des heures',        icon: '⏰', roles: ['admin', 'manager'] },
  { id: 'conges',    label: 'Gestion des congés',      icon: '🌴', roles: ['admin', 'manager'] },
  { id: 'export',    label: 'Export mensuel',           icon: '📊', roles: ['admin'] },
  { id: 'pins',      label: 'Gestion des PINs',         icon: '🔑', roles: ['admin'] },
]

export default function AdminDashboard() {
  const { user } = useAuth()

  // Filtrer les onglets selon le rôle
  const tabs = ALL_TABS.filter(t => t.roles.includes(user.role))
  const [tab, setTab] = useState(tabs[0]?.id || 'planning')

  const roleLabel = user.role === 'admin'
    ? 'Médecin — Administrateur'
    : 'Responsable — Assistante médicale'

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1 className="admin-title">
          {user.role === 'admin' ? 'Tableau de bord Administrateur' : `Bonjour, ${user.name}`}
        </h1>
        <p className="admin-subtitle">{roleLabel}</p>
      </div>

      <nav className="admin-tab-nav">
        {tabs.map(t => (
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
        {tab === 'planning'  && <PlanningTaches />}
        {tab === 'soldes'    && <SoldeHeures />}
        {tab === 'conges'    && <GestionConges />}
        {tab === 'export'    && <MonthlyExport />}
        {tab === 'pins'      && <GestionPins />}
      </div>
    </div>
  )
}
