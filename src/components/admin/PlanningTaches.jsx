import { useState, useEffect } from 'react'
import { JOURS, getWeekDays } from '../../utils/dateUtils'
import { getUsers } from '../../lib/localData'
import { useAuth } from '../../contexts/AuthContext'
import { getPlanningTaches, insertPlanningTache, updatePlanningTache, deletePlanningTache } from '../../lib/db'
import { format, addWeeks, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import Breadcrumb from '../shared/Breadcrumb'
import './PlanningTaches.css'

export default function PlanningTaches() {
  const { user } = useAuth()
  const assistants = getUsers().filter(u => u.role !== 'admin')

  const [weekRef, setWeekRef] = useState(new Date())
  const [taches,  setTaches]  = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null) // { userId, date, tache? }

  const [fTache, setFTache] = useState('')
  const [fDebut, setFDebut] = useState('08:00')
  const [fFin,   setFFin]   = useState('17:00')
  const [fNote,  setFNote]  = useState('')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const weekDays = getWeekDays(weekRef)
  const today    = format(new Date(), 'yyyy-MM-dd')

  const load = async () => {
    setLoading(true)
    try {
      const from = format(weekDays[0], 'yyyy-MM-dd')
      const to   = format(weekDays[6], 'yyyy-MM-dd')
      setTaches(await getPlanningTaches(assistants.map(a => a.id), from, to))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [weekRef])

  const getCellTaches = (userId, day) =>
    taches
      .filter(t => t.user_id === userId && t.date === format(day, 'yyyy-MM-dd'))
      .sort((a, b) => (a.heure_debut || '').localeCompare(b.heure_debut || ''))

  const openNew = (userId, dateStr) => {
    setModal({ userId, date: dateStr, tache: null })
    setFTache('')
    setFDebut('08:00')
    setFFin('17:00')
    setFNote('')
    setErr('')
  }

  const openEdit = (t) => {
    setModal({ userId: t.user_id, date: t.date, tache: t })
    setFTache(t.tache)
    setFDebut(t.heure_debut?.slice(0, 5) || '08:30')
    setFFin(t.heure_fin?.slice(0, 5)   || '16:30')
    setFNote(t.note || '')
    setErr('')
  }

  const handleSave = async () => {
    if (!fTache.trim()) { setErr('Le nom de la tâche est requis.'); return }
    setSaving(true); setErr('')
    try {
      const payload = {
        user_id:     modal.userId,
        date:        modal.date,
        tache:       fTache.trim(),
        heure_debut: fDebut,
        heure_fin:   fFin,
        note:        fNote || null,
        created_by:  user?.id,
      }
      modal.tache
        ? await updatePlanningTache(modal.tache.id, payload)
        : await insertPlanningTache(payload)
      await load()
      setModal(null)
    } catch (e) { setErr(e.message || 'Erreur lors de la sauvegarde') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true); setErr('')
    try {
      await deletePlanningTache(modal.tache.id)
      await load()
      setModal(null)
    } catch (e) { setErr(e.message || 'Erreur lors de la suppression') }
    finally { setSaving(false) }
  }

  const modalAssistant = modal ? assistants.find(a => a.id === modal.userId) : null

  return (
    <div className="pt-wrap">
      <Breadcrumb items={['Cabinet Médical', 'Planning', 'Tâches assignées']} />
      <div className="card">
        <div className="schedule-header" style={{ marginBottom: '1rem' }}>
          <h2 className="section-title">Planning des tâches</h2>
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
          <div className="planning-table-wrapper">
            <table className="planning-table pt-table">
              <thead>
                <tr>
                  <th className="user-col">Assistante</th>
                  {weekDays.map((day, i) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    return (
                      <th key={i} className={dateStr === today ? 'today-col' : ''}>
                        <div>{JOURS[i].slice(0, 3)}</div>
                        <div className="pt-th-date">{format(day, 'dd/MM', { locale: fr })}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {assistants.map(a => (
                  <tr key={a.id}>
                    <td className="user-cell"><strong>{a.name}</strong></td>
                    {weekDays.map((day, i) => {
                      const dateStr    = format(day, 'yyyy-MM-dd')
                      const isWeekend  = i >= 5
                      const cellTaches = getCellTaches(a.id, day)
                      return (
                        <td
                          key={i}
                          className={`pt-day-cell${dateStr === today ? ' today-cell' : ''}${isWeekend ? ' weekend-cell' : ''}`}
                        >
                          {cellTaches.map(t => (
                            <TacheChip key={t.id} tache={t} onClick={() => openEdit(t)} />
                          ))}
                          <button
                            className="pt-add-btn"
                            onClick={() => openNew(a.id, dateStr)}
                            title="Ajouter une tâche"
                          >
                            +
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="planning-hint">
          <span>💡</span> Cliquez sur <strong>+</strong> pour ajouter, sur une tâche pour modifier/supprimer.
        </p>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{modal.tache ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
                <p className="pt-modal-sub">
                  {modalAssistant?.name} —{' '}
                  {format(new Date(modal.date + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>

            <div className="modal-body">
              {err && <div className="error-msg">{err}</div>}

              <div className="form-group">
                <label>Tâche *</label>
                <input
                  type="text"
                  value={fTache}
                  onChange={e => setFTache(e.target.value)}
                  placeholder="Ex: Stérilisation, Accueil patients, Administratif…"
                  autoFocus
                />
              </div>

              <div className="pt-time-row">
                <div className="form-group">
                  <label>Heure début</label>
                  <input type="time" value={fDebut} onChange={e => setFDebut(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Heure fin</label>
                  <input type="time" value={fFin} onChange={e => setFFin(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label>Note (optionnel)</label>
                <input
                  type="text"
                  value={fNote}
                  onChange={e => setFNote(e.target.value)}
                  placeholder="Précisions sur la tâche..."
                />
              </div>
            </div>

            <div className="modal-footer">
              {modal.tache && (
                <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                  Supprimer
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setModal(null)} disabled={saving}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Sauvegarde...' : modal.tache ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TacheChip({ tache, onClick }) {
  return (
    <button
      className="pt-chip pt-chip-free"
      onClick={onClick}
      title={`${tache.tache} — cliquer pour modifier`}
    >
      <span className="pt-chip-label">{tache.tache}</span>
      <span className="pt-chip-hours">
        {tache.heure_debut?.slice(0, 5)}–{tache.heure_fin?.slice(0, 5)}
      </span>
    </button>
  )
}
