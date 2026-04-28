import { useState, useEffect } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, getDay, isToday, isBefore, startOfDay,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { getPlanningEventsByUser, getPlanningByUser } from '../../lib/db'
import './MyPlanning.css'

const STATUS = {
  travail: { label: 'Travail',    color: 'green',  icon: '✓' },
  conge:   { label: 'Congé',      color: 'orange', icon: '✈' },
  maladie: { label: 'Maladie',    color: 'red',    icon: '+' },
  absent:  { label: 'Absent',     color: 'gray',   icon: '—' },
  ferie:   { label: 'Jour férié', color: 'purple', icon: '★' },
}

export default function MyPlanning() {
  const { user } = useAuth()
  const [ref, setRef]           = useState(new Date())
  const [events, setEvents]     = useState({})
  const [template, setTemplate] = useState([])
  const [loading, setLoading]   = useState(true)

  const load = async () => {
    if (!user) return
    setLoading(true)
    try {
      const from = format(startOfMonth(ref), 'yyyy-MM-dd')
      const to   = format(endOfMonth(ref), 'yyyy-MM-dd')
      const [evData, tmData] = await Promise.all([
        getPlanningEventsByUser(user.id, from, to),
        getPlanningByUser(user.id),
      ])
      const ev = {}
      evData.forEach(e => { ev[e.date] = e })
      setEvents(ev)
      setTemplate(tmData)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [ref])

  const jourSemaine = (d) => { const n = getDay(d); return n === 0 ? 7 : n }

  const getCell = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    if (events[dateStr]) return { type: 'event', data: events[dateStr] }
    const jour = jourSemaine(date)
    const tm = template.find(t => t.jour_semaine === jour)
    if (tm?.actif) return { type: 'template', data: tm }
    return null
  }

  const days = eachDayOfInterval({ start: startOfMonth(ref), end: endOfMonth(ref) })
  const today = startOfDay(new Date())
  const title = format(ref, 'MMMM yyyy', { locale: fr })

  // Stats du mois
  const stats = { travail: 0, conge: 0, maladie: 0, absent: 0, ferie: 0, repos: 0 }
  days.forEach(d => {
    const cell = getCell(d)
    const isWE = getDay(d) === 0 || getDay(d) === 6
    if (cell?.type === 'event')    stats[cell.data.status] = (stats[cell.data.status] || 0) + 1
    else if (cell?.type === 'template') stats.travail++
    else if (isWE)                 stats.repos++
  })

  return (
    <div className="mp-wrap">
      <div className="mp-head card">
        <div className="mp-nav">
          <button className="btn btn-outline mp-nav-btn" onClick={() => setRef(d => subMonths(d, 1))}>‹</button>
          <span className="mp-title">{title}</span>
          <button className="btn btn-outline mp-nav-btn" onClick={() => setRef(d => addMonths(d, 1))}>›</button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mp-stats">
        {stats.travail > 0 && (
          <span className="mp-stat mp-stat-green">✓ {stats.travail} jour{stats.travail > 1 ? 's' : ''} travail</span>
        )}
        {stats.conge > 0 && (
          <span className="mp-stat mp-stat-orange">✈ {stats.conge} congé</span>
        )}
        {stats.maladie > 0 && (
          <span className="mp-stat mp-stat-red">+ {stats.maladie} maladie</span>
        )}
        {stats.ferie > 0 && (
          <span className="mp-stat mp-stat-purple">★ {stats.ferie} férié</span>
        )}
        {stats.absent > 0 && (
          <span className="mp-stat mp-stat-gray">— {stats.absent} absent</span>
        )}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="mp-list">
          {days.map(d => {
            const cell  = getCell(d)
            const isPast = isBefore(d, today) && !isToday(d)
            const isWE  = getDay(d) === 0 || getDay(d) === 6

            return (
              <div
                key={d.toISOString()}
                className={`mp-day${isToday(d) ? ' mp-today' : ''}${isPast ? ' mp-past' : ''}${isWE ? ' mp-weekend' : ''}`}
              >
                <div className="mp-day-label">
                  <span className="mp-day-name">{format(d, 'EEEE', { locale: fr })}</span>
                  <span className="mp-day-date">{format(d, 'd MMMM', { locale: fr })}</span>
                </div>
                <div className="mp-day-status">
                  {cell ? (
                    cell.type === 'event'
                      ? <EventChip event={cell.data} />
                      : <TemplateChip template={cell.data} />
                  ) : (
                    <span className="mp-no-event">{isWE ? 'Repos' : '—'}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EventChip({ event }) {
  const s = STATUS[event.status]
  if (!s) return null
  return (
    <div className={`mp-chip mp-chip-${s.color}`}>
      <span className="mp-chip-label">{s.icon} {s.label}</span>
      {event.status === 'travail' && event.heure_debut && (
        <span className="mp-chip-hours">{event.heure_debut.slice(0, 5)} – {event.heure_fin.slice(0, 5)}</span>
      )}
      {event.note && <span className="mp-chip-note">{event.note}</span>}
    </div>
  )
}

function TemplateChip({ template }) {
  return (
    <div className="mp-chip mp-chip-template">
      <span className="mp-chip-label">✓ Travail</span>
      {template.heure_debut && (
        <span className="mp-chip-hours">
          {template.heure_debut.slice(0, 5)} – {template.heure_fin.slice(0, 5)}
        </span>
      )}
    </div>
  )
}
