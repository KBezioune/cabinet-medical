import { useState, useEffect } from 'react'
import { JOURS, getWeekDays, minutesToHHMM } from '../../utils/dateUtils'
import { getAssistants, getPlanningForUsers, getPointagesByDateRange, upsertPlanning } from '../../lib/localData'
import { format, addWeeks, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import './WeeklyPlanning.css'

export default function WeeklyPlanning() {
  const [planning,  setPlanning]  = useState([])
  const [pointages, setPointages] = useState([])
  const [weekRef,   setWeekRef]   = useState(new Date())
  const [editingPlan, setEditingPlan] = useState(null)
  const [msg, setMsg] = useState(null)

  const assistants = getAssistants()
  const weekDays   = getWeekDays(weekRef)

  const refresh = () => {
    const dateFrom = format(weekDays[0], 'yyyy-MM-dd')
    const dateTo   = format(weekDays[6], 'yyyy-MM-dd')
    const ids = assistants.map(u => u.id)
    setPlanning(getPlanningForUsers(ids))
    setPointages(getPointagesByDateRange(ids, dateFrom, dateTo))
  }

  useEffect(() => { refresh() }, [weekRef])

  const getPlan = (userId, dayIndex) =>
    planning.find(p => p.user_id === userId && p.jour_semaine === dayIndex + 1)

  const getPointage = (userId, date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return pointages.find(p => p.user_id === userId && p.date === dateStr)
  }

  const savePlan = (userId, dayIndex, heure_debut, heure_fin) => {
    upsertPlanning(userId, dayIndex + 1, heure_debut, heure_fin)
    setMsg({ type: 'success', text: 'Planning mis à jour !' })
    setTimeout(() => setMsg(null), 3000)
    setEditingPlan(null)
    refresh()
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {msg && <div className={msg.type === 'error' ? 'error-msg' : 'success-msg'}>{msg.text}</div>}

      <div className="card">
        <div className="schedule-header" style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-title">Planning hebdomadaire</h2>
          <div className="week-nav">
            <button className="btn btn-outline btn-sm" onClick={() => setWeekRef(d => subWeeks(d, 1))}>← Semaine préc.</button>
            <span className="week-label">
              {format(weekDays[0], 'dd MMM', { locale: fr })} – {format(weekDays[6], 'dd MMM yyyy', { locale: fr })}
            </span>
            <button className="btn btn-outline btn-sm" onClick={() => setWeekRef(d => addWeeks(d, 1))}>Semaine suiv. →</button>
          </div>
        </div>

        <div className="planning-table-wrapper">
          <table className="planning-table">
            <thead>
              <tr>
                <th className="user-col">Assistante</th>
                {weekDays.map((day, i) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  return (
                    <th key={i} className={dateStr === today ? 'today-col' : ''}>
                      <div>{JOURS[i].slice(0, 3)}</div>
                      <div style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                        {format(day, 'dd/MM', { locale: fr })}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {assistants.map(u => (
                <tr key={u.id}>
                  <td className="user-cell"><strong>{u.name}</strong></td>
                  {weekDays.map((day, i) => {
                    const plan    = getPlan(u.id, i)
                    const pt      = getPointage(u.id, day)
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const isWeekend = i >= 5

                    return (
                      <td key={i} className={`day-cell ${dateStr === today ? 'today-cell' : ''} ${isWeekend ? 'weekend-cell' : ''}`}>
                        {editingPlan?.userId === u.id && editingPlan?.dayIndex === i ? (
                          <PlanEditor
                            plan={plan}
                            onSave={(d, f) => savePlan(u.id, i, d, f)}
                            onCancel={() => setEditingPlan(null)}
                          />
                        ) : (
                          <div className="plan-cell-content" onClick={() => setEditingPlan({ userId: u.id, dayIndex: i })} title="Cliquer pour modifier">
                            {plan?.actif ? (
                              <div className="plan-info">
                                <span className="plan-hours">{plan.heure_debut?.slice(0,5)}–{plan.heure_fin?.slice(0,5)}</span>
                                {pt && (
                                  <span className="pt-badge">
                                    {pt.heure_arrivee ? format(new Date(pt.heure_arrivee), 'HH:mm') : '?'}
                                    {pt.heure_depart  ? '→' + format(new Date(pt.heure_depart), 'HH:mm') : ' ▶'}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="no-plan">{isWeekend ? 'Repos' : '+'}</span>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: '0.75rem' }}>
          Cliquez sur une cellule pour modifier le planning.
        </p>
      </div>
    </div>
  )
}

function PlanEditor({ plan, onSave, onCancel }) {
  const [debut, setDebut] = useState(plan?.heure_debut?.slice(0,5) || '08:00')
  const [fin,   setFin]   = useState(plan?.heure_fin?.slice(0,5)   || '17:00')
  return (
    <div className="plan-editor">
      <input type="time" value={debut} onChange={e => setDebut(e.target.value)} className="time-input" />
      <input type="time" value={fin}   onChange={e => setFin(e.target.value)}   className="time-input" />
      <div className="plan-editor-actions">
        <button className="btn-tiny btn-save"   onClick={() => onSave(debut, fin)}>✓</button>
        <button className="btn-tiny btn-cancel" onClick={onCancel}>✗</button>
        <button className="btn-tiny btn-clear"  onClick={() => onSave('', '')} title="Supprimer">—</button>
      </div>
    </div>
  )
}
