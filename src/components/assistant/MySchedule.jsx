import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { JOURS, getWeekDays } from '../../utils/dateUtils'
import { getPlanningByUser, getPointagesByDateRange } from '../../lib/db'
import { getAssistants } from '../../lib/localData'
import { format, addWeeks, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import './MySchedule.css'

export default function MySchedule() {
  const { user } = useAuth()
  const [planning, setPlanning]   = useState([])
  const [pointages, setPointages] = useState([])
  const [weekRef, setWeekRef]     = useState(new Date())
  const [loading, setLoading]     = useState(true)

  const weekDays = getWeekDays(weekRef)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const dateFrom = format(weekDays[0], 'yyyy-MM-dd')
      const dateTo   = format(weekDays[6], 'yyyy-MM-dd')
      try {
        const [pl, pt] = await Promise.all([
          getPlanningByUser(user.id),
          getPointagesByDateRange([user.id], dateFrom, dateTo),
        ])
        setPlanning(pl)
        setPointages(pt)
      } catch { /* silencieux */ }
      finally { setLoading(false) }
    }
    fetch()
  }, [weekRef, user.id])

  const getPlanForDay    = (i) => planning.find(p => p.jour_semaine === i + 1)
  const getPointageForDate = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return pointages.find(p => p.date === dateStr)
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="card">
      <div className="schedule-header">
        <h2 className="section-title">Mon Planning</h2>
        <div className="week-nav">
          <button className="btn btn-outline btn-sm" onClick={() => setWeekRef(d => subWeeks(d, 1))}>← Semaine préc.</button>
          <span className="week-label">
            {format(weekDays[0], 'dd MMM', { locale: fr })} – {format(weekDays[6], 'dd MMM yyyy', { locale: fr })}
          </span>
          <button className="btn btn-outline btn-sm" onClick={() => setWeekRef(d => addWeeks(d, 1))}>Semaine suiv. →</button>
        </div>
      </div>

      {loading ? <div className="loading-center"><div className="spinner"/></div> : (
        <div className="schedule-grid">
          {weekDays.map((day, i) => {
            const dateStr   = format(day, 'yyyy-MM-dd')
            const plan      = getPlanForDay(i)
            const pt        = getPointageForDate(day)
            const isToday   = dateStr === today
            const isWeekend = i >= 5
            return (
              <div key={dateStr} className={`schedule-day ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}>
                <div className="day-header">
                  <span className="day-name">{JOURS[i]}</span>
                  <span className="day-date">{format(day, 'dd/MM', { locale: fr })}</span>
                  {isToday && <span className="badge badge-blue">Aujourd'hui</span>}
                </div>
                <div className="day-body">
                  {isWeekend && !plan ? <span className="day-off">Repos</span>
                  : plan ? (
                    <div className="day-planned">
                      <div className="planned-hours">
                        <span>📋</span>
                        <span>{plan.heure_debut?.slice(0,5)} – {plan.heure_fin?.slice(0,5)}</span>
                      </div>
                      {pt && (
                        <div className="actual-hours">
                          <span>⏱</span>
                          <span className="actual-label">Réel :</span>
                          <span>{pt.heure_arrivee ? format(new Date(pt.heure_arrivee), 'HH:mm') : '—'}</span>
                          <span>→</span>
                          <span>{pt.heure_depart ? format(new Date(pt.heure_depart), 'HH:mm') : '...'}</span>
                        </div>
                      )}
                    </div>
                  ) : <span className="day-off">Pas planifié</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
