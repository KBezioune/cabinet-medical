import { useState, useEffect } from 'react'
import { getUsers } from '../../lib/localData'
import { getPlanningForUsers, getPlanningTaches, getAllConges } from '../../lib/db'
import { JOURS, getWeekDays } from '../../utils/dateUtils'
import { format, addWeeks, subWeeks, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import './PlanningPartage.css'

const TACHES_CFG = {
  consultation:  { label: 'Consultation',  icon: '🩺', color: 'blue'   },
  sterilisation: { label: 'Stérilisation', icon: '🧴', color: 'teal'   },
  accueil:       { label: 'Accueil',       icon: '😊', color: 'green'  },
  administratif: { label: 'Administratif', icon: '📋', color: 'orange' },
  autre:         { label: 'Autre',         icon: '📌', color: 'gray'   },
}

const ROLE_LABEL = { admin: 'Médecin', manager: 'Manager', assistant: 'Assistante' }

export default function PlanningPartage() {
  const [weekRef, setWeekRef] = useState(new Date())
  const [planning, setPlanning] = useState([])
  const [taches,   setTaches]   = useState([])
  const [conges,   setConges]   = useState([])
  const [loading,  setLoading]  = useState(true)

  const users    = getUsers()
  const weekDays = getWeekDays(weekRef)
  const today    = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const from = format(weekDays[0], 'yyyy-MM-dd')
      const to   = format(weekDays[6], 'yyyy-MM-dd')
      const ids  = users.map(u => u.id)
      try {
        const [pl, tch, cg] = await Promise.all([
          getPlanningForUsers(ids),
          getPlanningTaches(ids, from, to),
          getAllConges(),
        ])
        setPlanning(pl)
        setTaches(tch)
        setConges(cg)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [weekRef])

  // Planning horaire du jour (basé sur le jour de semaine récurrent)
  const getDayPlan = (userId, day) => {
    const jourSem = getDay(day) === 0 ? 7 : getDay(day)
    return planning.find(p => p.user_id === userId && p.jour_semaine === jourSem && p.actif) || null
  }

  // Tâches planifiées sur ce jour précis
  const getDayTaches = (userId, dateStr) =>
    taches
      .filter(t => t.user_id === userId && t.date === dateStr)
      .sort((a, b) => (a.heure_debut || '').localeCompare(b.heure_debut || ''))

  // Congé actif sur ce jour (approuvé ou en attente)
  const getDayConge = (userId, dateStr) =>
    conges.find(c =>
      c.user_id === userId &&
      c.date_debut <= dateStr &&
      c.date_fin   >= dateStr &&
      c.statut !== 'refuse'
    ) || null

  const weekLabel = `${format(weekDays[0], 'dd MMM', { locale: fr })} – ${format(weekDays[6], 'dd MMM yyyy', { locale: fr })}`

  return (
    <div className="pp-wrap">
      <div className="card pp-card">
        {/* En-tête + navigation */}
        <div className="pp-header">
          <div>
            <h2 className="pp-title">Planning de l'équipe</h2>
            <p className="pp-subtitle">Vue semaine · lecture seule</p>
          </div>
          <div className="pp-nav">
            <button className="btn btn-outline pp-btn-nav" onClick={() => setWeekRef(d => subWeeks(d, 1))}>
              ← Préc.
            </button>
            <span className="pp-week-label">{weekLabel}</span>
            <button className="btn btn-outline pp-btn-nav" onClick={() => setWeekRef(d => addWeeks(d, 1))}>
              Suiv. →
            </button>
          </div>
        </div>

        {/* Légende */}
        <div className="pp-legend">
          {Object.entries(TACHES_CFG).map(([k, v]) => (
            <span key={k} className={`pp-legend-chip pp-chip-${v.color}`}>
              {v.icon} {v.label}
            </span>
          ))}
          <span className="pp-legend-chip pp-chip-conge">🌴 Congé</span>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th className="pp-th-user">Collaborateur</th>
                  {weekDays.map((day, i) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const isToday = dateStr === today
                    const isWE    = i >= 5
                    return (
                      <th
                        key={i}
                        className={`pp-th-day${isToday ? ' pp-th-today' : ''}${isWE ? ' pp-th-we' : ''}`}
                      >
                        <span className="pp-th-jour">{JOURS[i].slice(0, 3)}</span>
                        <span className="pp-th-date">{format(day, 'dd/MM', { locale: fr })}</span>
                        {isToday && <span className="pp-today-dot" aria-hidden="true" />}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={`pp-row pp-row-${u.role}`}>
                    {/* Cellule utilisateur (sticky) */}
                    <td className="pp-td-user">
                      <div className="pp-user">
                        <div className={`pp-avatar pp-avatar-${u.role}`}>{u.name[0]}</div>
                        <div className="pp-user-info">
                          <span className="pp-user-name">{u.name}</span>
                          <span className="pp-user-role">{ROLE_LABEL[u.role]}</span>
                        </div>
                      </div>
                    </td>

                    {/* Cellules jours */}
                    {weekDays.map((day, i) => {
                      const dateStr   = format(day, 'yyyy-MM-dd')
                      const isToday   = dateStr === today
                      const isWE      = i >= 5
                      const plan      = getDayPlan(u.id, day)
                      const dayTaches = getDayTaches(u.id, dateStr)
                      const conge     = getDayConge(u.id, dateStr)

                      return (
                        <td
                          key={i}
                          className={`pp-td${isToday ? ' pp-td-today' : ''}${isWE ? ' pp-td-we' : ''}${conge ? ' pp-td-conge' : ''}`}
                        >
                          {conge ? (
                            /* Bloc congé */
                            <div className={`pp-conge ${conge.statut === 'approuve' ? 'pp-conge-ok' : 'pp-conge-wait'}`}>
                              <span>🌴</span>
                              <span className="pp-conge-label">
                                {conge.statut === 'approuve' ? 'Congé' : 'En attente'}
                              </span>
                            </div>
                          ) : (
                            <>
                              {/* Heures planifiées */}
                              {plan && (
                                <div className="pp-hours">
                                  {plan.heure_debut.slice(0, 5)}–{plan.heure_fin.slice(0, 5)}
                                </div>
                              )}

                              {/* Tâches */}
                              {dayTaches.map(t => {
                                const cfg = TACHES_CFG[t.tache] || TACHES_CFG.autre
                                return (
                                  <div key={t.id} className={`pp-tache pp-tache-${cfg.color}`} title={t.note || cfg.label}>
                                    <span className="pp-tache-icon">{cfg.icon}</span>
                                    <span className="pp-tache-body">
                                      <span className="pp-tache-label">{cfg.label}</span>
                                      {(t.heure_debut || t.heure_fin) && (
                                        <span className="pp-tache-hours">
                                          {t.heure_debut?.slice(0, 5)}–{t.heure_fin?.slice(0, 5)}
                                        </span>
                                      )}
                                    </span>
                                    {t.note && <span className="pp-tache-note-dot" title={t.note}>·</span>}
                                  </div>
                                )
                              })}

                              {/* Rien de planifié */}
                              {!plan && dayTaches.length === 0 && (
                                <span className="pp-empty">
                                  {isWE ? '—' : ''}
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
