import { useState } from 'react'
import ClockInOut from './ClockInOut'
import MySchedule from './MySchedule'
import MyHistory from './MyHistory'
import './AssistantDashboard.css'

const TABS = [
  { id: 'clock', label: 'Pointage', icon: '⏱️' },
  { id: 'schedule', label: 'Mon Planning', icon: '📅' },
  { id: 'history', label: 'Mes Pointages', icon: '📋' },
]

export default function AssistantDashboard() {
  const [tab, setTab] = useState('clock')

  return (
    <div className="assistant-dashboard">
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

      <div className="tab-content">
        {tab === 'clock' && <ClockInOut />}
        {tab === 'schedule' && <MySchedule />}
        {tab === 'history' && <MyHistory />}
      </div>
    </div>
  )
}
