import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { JOURS, getWeekDays } from '../../utils/dateUtils'
import { getPlanningTachesByUser } from '../../lib/db'
import { format, addWeeks, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import './MonPlanningTaches.css'

const TACHES = {
  consultation:  { label: 'Consultation',  icon: '🩺', color: 'blue'   },
  sterilisation: { label: 'Stérilisation', icon: '🧴', color: 'teal'   },
  accueil:       { label: 'Accueil',       icon: '😊', color: 'green'  },
  administratif: { label: 'Administratif', icon: '📋', color: 'orange' },
  autre:         { label: 'Autre',         icon: '📌', color: 'gray'   },
}

export default function MonPlanningTaches() {
  const { user } = useAuth()
  const [weekRef, setWeekRef] = useState(new Date())
  const [taches,  setTaches]  = useState([])
  const [loading, setLoading] = useState(true)

  const weekDays = getWeekDays(weekRef)
  const today    = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const from = format(weekDays[0], 'yyyy-MM-dd')
        const to   = format(weekDays[6], 'yyyy-MM-dd')
        setTaches(await getPlanningTachesByUser(user.id, from, to))
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [weekRef, user.id])

  const getDayTaches = (day) =>
    taches
      .filter(t => t.date === format(day, 'yyyy-MM-dd'))
      .sort((a, b) => (a.heure_debut || '').localeCompare(b.heure_debut || ''))

  return (
    <div className="card">
      <div className="schedule-header">
        <h2 className="section-title">Mon Planning</h2>
        <div className="week-nav">
          <button className="btn btn-outline btn-sm" onClick={() => setWeekRef(d => subWeeks(d, 1))}>
            ← Semaine préc.
          </button>
          <span className="week-label">
            {format(weekDays[0], 'dd MMM', { locale: fr })} – {format(weekDays[6], 'dd MMM yyyy', { locale: fr })}
          </span>
          <button className="btn btn-outline btn-sm" onClick={() => setWeekRef(d => addWeeks(d, 1))}>
            Semaine suiv. →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="mpt-grid">
          {weekDays.map((day, i) => {
            const dateStr   = format(day, 'yyyy-MM-dd')
            const isToday   = dateStr === today
            const isWeekend = i >= 5
            const dayTaches = getDayTaches(day)

            return (
              <div
                key={dateStr}
                className={`mpt-day${isToday ? ' mpt-today' : ''}${isWeekend ? ' mpt-weekend' : ''}`}
              >
                <div className="mpt-day-header">
                  <div className="mpt-day-left">
                    <span className="day-name">{JOURS[i]}</span>
                    <span className="day-date">{format(day, 'dd/MM', { locale: fr })}</span>
                  </div>
                  {isToday && <span className="badge badge-blue">Aujourd'hui</span>}
                </div>

                <div className="mpt-day-body">
                  {dayTaches.length === 0 ? (
                    <span className="mpt-empty">{isWeekend ? '😴 Repos' : 'Aucune tâche planifiée'}</span>
                  ) : (
                    dayTaches.map(t => {
                      const cfg = TACHES[t.tache] || TACHES.autre
                      return (
                        <div key={t.id} className={`mpt-tache mpt-tache-${cfg.color}`}>
                          <div className="mpt-tache-top">
                            <span className="mpt-tache-type">{cfg.icon} {cfg.label}</span>
                            <span className="mpt-tache-hours">
                              {t.heure_debut?.slice(0, 5)} – {t.heure_fin?.slice(0, 5)}
                            </span>
                          </div>
                          {t.note && <div className="mpt-tache-note">{t.note}</div>}
                        </div>
                      )
                    })
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
