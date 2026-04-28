import { useState, useEffect, useCallback } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks,
  getDay, isToday,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuth } from '../../contexts/AuthContext'
import { getAssistants } from '../../lib/localData'
import { getPlanningEvents, upsertPlanningEvent, deletePlanningEvent, getPlanningForUsers } from '../../lib/db'
import './PlanningCalendar.css'

const STATUS = {
  travail: { label: 'Travail',    short: 'T', color: 'green',  icon: '✓' },
  conge:   { label: 'Congé',      short: 'C', color: 'orange', icon: '✈' },
  maladie: { label: 'Maladie',    short: 'M', color: 'red',    icon: '+' },
  absent:  { label: 'Absent',     short: 'A', color: 'gray',   icon: '—' },
  ferie:   { label: 'Jour férié', short: 'F', color: 'purple', icon: '★' },
}

export default function PlanningCalendar() {
  const { user } = useAuth()
  const assistants = getAssistants()

  const [view, setView]           = useState('month')
  const [ref, setRef]             = useState(new Date())
  const [events, setEvents]       = useState({})
  const [templates, setTemplates] = useState({})
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null)

  const [fStatus, setFStatus] = useState('travail')
  const [fDebut, setFDebut]   = useState('08:00')
  const [fFin, setFFin]       = useState('17:00')
  const [fNote, setFNote]     = useState('')
  const [fAll, setFAll]       = useState(false)
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  const getDays = useCallback(() => {
    if (view === 'month') {
      return eachDayOfInterval({ start: startOfMonth(ref), end: endOfMonth(ref) })
    }
    return eachDayOfInterval({
      start: startOfWeek(ref, { weekStartsOn: 1 }),
      end:   endOfWeek(ref,   { weekStartsOn: 1 }),
    })
  }, [view, ref])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const days = getDays()
      const from = format(days[0], 'yyyy-MM-dd')
      const to   = format(days[days.length - 1], 'yyyy-MM-dd')
      const ids  = assistants.map(a => a.id)
      const [evData, tmData] = await Promise.all([
        getPlanningEvents(ids, from, to),
        getPlanningForUsers(ids),
      ])
      const ev = {}
      evData.forEach(e => { ev[`${e.user_id}_${e.date}`] = e })
      const tm = {}
      tmData.forEach(t => { tm[`${t.user_id}_${t.jour_semaine}`] = t })
      setEvents(ev)
      setTemplates(tm)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [getDays, assistants])

  useEffect(() => { load() }, [load])

  const jourSemaine = (d) => { const n = getDay(d); return n === 0 ? 7 : n }

  const getCell = (userId, date) => {
    const ev = events[`${userId}_${format(date, 'yyyy-MM-dd')}`]
    if (ev) return { type: 'event', data: ev }
    const tm = templates[`${userId}_${jourSemaine(date)}`]
    if (tm?.actif) return { type: 'template', data: tm }
    return null
  }

  const navigate = (dir) => {
    if (view === 'month') setRef(d => dir > 0 ? addMonths(d, 1) : subMonths(d, 1))
    else                  setRef(d => dir > 0 ? addWeeks(d, 1)  : subWeeks(d, 1))
  }

  const openModal = (userId, date) => {
    const key = `${userId}_${format(date, 'yyyy-MM-dd')}`
    const ev  = events[key]
    const tm  = templates[`${userId}_${jourSemaine(date)}`]
    setModal({ userId, date })
    setFStatus(ev?.status || 'travail')
    setFDebut(ev?.heure_debut?.slice(0, 5) || tm?.heure_debut?.slice(0, 5) || '08:00')
    setFFin(ev?.heure_fin?.slice(0, 5)   || tm?.heure_fin?.slice(0, 5)   || '17:00')
    setFNote(ev?.note || '')
    setFAll(false)
    setErr('')
  }

  const handleSave = async () => {
    setSaving(true); setErr('')
    try {
      const dateStr = format(modal.date, 'yyyy-MM-dd')
      const ids = fAll ? assistants.map(a => a.id) : [modal.userId]
      for (const uid of ids) {
        await upsertPlanningEvent({
          user_id:     uid,
          date:        dateStr,
          status:      fStatus,
          heure_debut: fStatus === 'travail' ? fDebut : null,
          heure_fin:   fStatus === 'travail' ? fFin   : null,
          note:        fNote || null,
          created_by:  user?.id,
        })
      }
      await load()
      setModal(null)
    } catch (e) { setErr(e.message || 'Erreur lors de la sauvegarde') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true); setErr('')
    try {
      await deletePlanningEvent(modal.userId, format(modal.date, 'yyyy-MM-dd'))
      await load()
      setModal(null)
    } catch (e) { setErr(e.message || 'Erreur lors de la suppression') }
    finally { setSaving(false) }
  }

  const days = getDays()
  const modalAssistant = modal ? assistants.find(a => a.id === modal.userId) : null
  const hasEvent = modal && !!events[`${modal.userId}_${format(modal.date, 'yyyy-MM-dd')}`]

  const title = view === 'month'
    ? format(ref, 'MMMM yyyy', { locale: fr })
    : `${format(startOfWeek(ref, { weekStartsOn: 1 }), 'd MMM', { locale: fr })} – ${format(endOfWeek(ref, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: fr })}`

  return (
    <div className="pc-wrap">
      <div className="pc-head card">
        <div className="pc-nav">
          <button className="btn btn-outline pc-nav-btn" onClick={() => navigate(-1)}>‹</button>
          <span className="pc-title">{title}</span>
          <button className="btn btn-outline pc-nav-btn" onClick={() => navigate(1)}>›</button>
        </div>
        <div className="pc-toggle">
          <button className={`pc-toggle-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Mois</button>
          <button className={`pc-toggle-btn ${view === 'week'  ? 'active' : ''}`} onClick={() => setView('week')}>Semaine</button>
        </div>
      </div>

      <div className="pc-legend">
        {Object.entries(STATUS).map(([k, v]) => (
          <span key={k} className={`pc-legend-item pc-dot-${v.color}`}>{v.label}</span>
        ))}
        <span className="pc-legend-item pc-dot-template">Planning type</span>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className={`table-wrapper pc-table-outer${view === 'week' ? ' pc-week-mode' : ''}`}>
          <table className="pc-table" data-view={view}>
            <thead>
              <tr>
                <th className="pc-th-name">Assistante</th>
                {days.map(d => {
                  const isWE = getDay(d) === 0 || getDay(d) === 6
                  return (
                    <th
                      key={d.toISOString()}
                      className={`pc-th-day${isToday(d) ? ' pc-today-col' : ''}${isWE ? ' pc-weekend-col' : ''}`}
                    >
                      <span className="pc-d-name">{format(d, 'EEE', { locale: fr })}</span>
                      <span className={`pc-d-num${isToday(d) ? ' pc-today-num' : ''}`}>{format(d, 'd')}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {assistants.map(a => (
                <tr key={a.id}>
                  <td className="pc-td-name">{a.name}</td>
                  {days.map(d => {
                    const cell = getCell(a.id, d)
                    const isWE = getDay(d) === 0 || getDay(d) === 6
                    return (
                      <td
                        key={d.toISOString()}
                        className={`pc-td-cell${isToday(d) ? ' pc-today-col' : ''}${isWE ? ' pc-weekend-col' : ''}`}
                        onClick={() => openModal(a.id, d)}
                        title={`${a.name} — ${format(d, 'EEEE d MMMM', { locale: fr })}`}
                      >
                        <Cell cell={cell} isWeek={view === 'week'} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{modalAssistant?.name}</h2>
                <p className="pc-modal-date">{format(modal.date, 'EEEE d MMMM yyyy', { locale: fr })}</p>
              </div>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div className="error-msg">{err}</div>}

              <div className="form-group">
                <label>Statut</label>
                <div className="pc-status-grid">
                  {Object.entries(STATUS).map(([k, v]) => (
                    <button
                      key={k}
                      className={`pc-status-btn pc-status-${v.color}${fStatus === k ? ' active' : ''}`}
                      onClick={() => setFStatus(k)}
                    >
                      <span className="pc-status-icon">{v.icon}</span>
                      <span>{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {fStatus === 'travail' && (
                <div className="pc-time-row">
                  <div className="form-group">
                    <label>Début</label>
                    <input type="time" value={fDebut} onChange={e => setFDebut(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Fin</label>
                    <input type="time" value={fFin} onChange={e => setFFin(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Note (optionnel)</label>
                <input
                  type="text"
                  value={fNote}
                  onChange={e => setFNote(e.target.value)}
                  placeholder="ex: réunion, déplacement..."
                />
              </div>

              <label className="pc-apply-all">
                <input type="checkbox" checked={fAll} onChange={e => setFAll(e.target.checked)} />
                <span>Appliquer à toutes les assistantes</span>
              </label>
            </div>
            <div className="modal-footer">
              {hasEvent && (
                <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                  Supprimer
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setModal(null)} disabled={saving}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Cell({ cell, isWeek }) {
  if (!cell) return <span className="pc-cell-empty">+</span>

  if (cell.type === 'event') {
    const s = STATUS[cell.data.status]
    if (!s) return null
    return (
      <div className={`pc-cell pc-cell-${s.color}`}>
        <span className="pc-cell-label">{isWeek ? s.label : s.short}</span>
        {cell.data.status === 'travail' && cell.data.heure_debut && (
          <span className="pc-cell-hours">
            {cell.data.heure_debut.slice(0, 5)}–{cell.data.heure_fin.slice(0, 5)}
          </span>
        )}
        {isWeek && cell.data.note && (
          <span className="pc-cell-note">{cell.data.note}</span>
        )}
      </div>
    )
  }

  return (
    <div className="pc-cell pc-cell-template">
      <span className="pc-cell-label">{isWeek ? 'Travail' : 'T'}</span>
      {isWeek && cell.data.heure_debut && (
        <span className="pc-cell-hours">
          {cell.data.heure_debut.slice(0, 5)}–{cell.data.heure_fin.slice(0, 5)}
        </span>
      )}
    </div>
  )
}
