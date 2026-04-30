import { useState, useEffect } from 'react'
import { getUsers } from '../../lib/localData'
import { useAuth } from '../../contexts/AuthContext'
import {
  getPlanningForUsers, getPlanningTaches, getAllConges,
  insertPlanningTache, updatePlanningTache, deletePlanningTache,
} from '../../lib/db'
import { JOURS, getWeekDays } from '../../utils/dateUtils'
import { format, addWeeks, subWeeks, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import Breadcrumb from './Breadcrumb'
import './PlanningPartage.css'

const TACHES_CFG = {
  consultation:  { label: 'Consultation',  icon: '🩺', color: 'blue'   },
  sterilisation: { label: 'Stérilisation', icon: '🧴', color: 'teal'   },
  accueil:       { label: 'Accueil',       icon: '😊', color: 'green'  },
  administratif: { label: 'Administratif', icon: '📋', color: 'orange' },
  autre:         { label: 'Autre',         icon: '📌', color: 'gray'   },
  conge:         { label: 'Congé',         icon: '🌴', color: 'conge'  },
}

const ROLE_LABEL = { admin: 'Médecin', manager: 'Manager', assistant: 'Assistante' }
const DEFAULT_DEBUT = '08:30'
const DEFAULT_FIN   = '17:30'

export default function PlanningPartage() {
  const { user }  = useAuth()
  const isAdmin   = user?.role === 'admin'

  const [weekRef,   setWeekRef]   = useState(new Date())
  const [planning,  setPlanning]  = useState([])
  const [taches,    setTaches]    = useState([])
  const [conges,    setConges]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [editMode,  setEditMode]  = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Modal
  const [modal,   setModal]  = useState(null) // { userId, userName, dateStr, existing: obj|null }
  const [fType,   setFType]  = useState('consultation')
  const [fDebut,  setFDebut] = useState(DEFAULT_DEBUT)
  const [fFin,    setFFin]   = useState(DEFAULT_FIN)
  const [saving,  setSaving] = useState(false)
  const [err,     setErr]    = useState('')

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
  }, [weekRef, reloadKey])

  // Horaires récurrents — fallback 08:30-17:30 les jours ouvrables
  const getDayPlan = (userId, day) => {
    const jourSem = getDay(day) === 0 ? 7 : getDay(day)
    const found   = planning.find(p => p.user_id === userId && p.jour_semaine === jourSem && p.actif)
    if (found) return found
    if (jourSem >= 1 && jourSem <= 5) return { heure_debut: DEFAULT_DEBUT, heure_fin: DEFAULT_FIN, fallback: true }
    return null
  }

  const getDayTaches = (userId, dateStr) =>
    taches
      .filter(t => t.user_id === userId && t.date === dateStr)
      .sort((a, b) => (a.heure_debut || '').localeCompare(b.heure_debut || ''))

  const getDayConge = (userId, dateStr) =>
    conges.find(c =>
      c.user_id === userId &&
      c.date_debut <= dateStr &&
      c.date_fin   >= dateStr &&
      c.statut !== 'refuse'
    ) || null

  // ── Modal helpers ─────────────────────────────────────────────
  const openNew = (userId, userName, dateStr) => {
    setModal({ userId, userName, dateStr, existing: null })
    setFType('consultation'); setFDebut(DEFAULT_DEBUT); setFFin(DEFAULT_FIN)
    setErr('')
  }

  const openEdit = (t, userName) => {
    setModal({ userId: t.user_id, userName, dateStr: t.date, existing: t })
    setFType(t.tache)
    setFDebut(t.heure_debut?.slice(0, 5) || DEFAULT_DEBUT)
    setFFin(t.heure_fin?.slice(0, 5)     || DEFAULT_FIN)
    setErr('')
  }

  const handleSave = async () => {
    setSaving(true); setErr('')
    try {
      const payload = {
        user_id:     modal.userId,
        date:        modal.dateStr,
        tache:       fType,
        heure_debut: fDebut || null,
        heure_fin:   fFin   || null,
        created_by:  user?.id,
      }
      if (modal.existing) {
        await updatePlanningTache(modal.existing.id, payload)
      } else {
        await insertPlanningTache(payload)
      }
      setModal(null)
      setReloadKey(k => k + 1)
    } catch (e) { setErr(e.message || 'Erreur lors de la sauvegarde') }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    setSaving(true); setErr('')
    try {
      await deletePlanningTache(modal.existing.id)
      setModal(null)
      setReloadKey(k => k + 1)
    } catch (e) { setErr(e.message || 'Erreur lors de la suppression') }
    finally { setSaving(false) }
  }

  const weekLabel = `${format(weekDays[0], 'dd MMM', { locale: fr })} – ${format(weekDays[6], 'dd MMM yyyy', { locale: fr })}`

  return (
    <div className="pp-wrap">
      <Breadcrumb items={['Cabinet Médical', 'Planning', 'Planning équipe']} />

      <div className="card pp-card">
        {/* En-tête */}
        <div className="pp-header">
          <div>
            <h2 className="pp-title">Planning de l'équipe</h2>
            <p className="pp-subtitle">
              {editMode ? '✏️ Mode édition — cliquez sur un créneau ou sur + pour ajouter' : 'Vue semaine · lecture seule'}
            </p>
          </div>
          <div className="pp-header-right">
            {isAdmin && (
              <button
                className={`btn pp-edit-btn ${editMode ? 'pp-edit-active' : 'btn-outline'}`}
                onClick={() => { setEditMode(v => !v); setModal(null) }}
              >
                {editMode ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Terminer
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Modifier le planning
                  </>
                )}
              </button>
            )}
            <div className="pp-nav">
              <button className="btn btn-outline pp-btn-nav" onClick={() => setWeekRef(d => subWeeks(d, 1))}>← Préc.</button>
              <span className="pp-week-label">{weekLabel}</span>
              <button className="btn btn-outline pp-btn-nav" onClick={() => setWeekRef(d => addWeeks(d, 1))}>Suiv. →</button>
            </div>
          </div>
        </div>

        {/* Légende */}
        <div className="pp-legend">
          {Object.entries(TACHES_CFG).map(([k, v]) => (
            <span key={k} className={`pp-legend-chip pp-chip-${v.color}`}>{v.icon} {v.label}</span>
          ))}
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
                      <th key={i} className={`pp-th-day${isToday ? ' pp-th-today' : ''}${isWE ? ' pp-th-we' : ''}`}>
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
                    <td className="pp-td-user">
                      <div className="pp-user">
                        <div className={`pp-avatar pp-avatar-${u.role}`}>{u.name[0]}</div>
                        <div className="pp-user-info">
                          <span className="pp-user-name">{u.name}</span>
                          <span className="pp-user-role">{ROLE_LABEL[u.role]}</span>
                        </div>
                      </div>
                    </td>

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
                          className={`pp-td${isToday ? ' pp-td-today' : ''}${isWE ? ' pp-td-we' : ''}${conge ? ' pp-td-conge' : ''}${editMode ? ' pp-td-editable' : ''}`}
                        >
                          {conge ? (
                            <div className={`pp-conge ${conge.statut === 'approuve' ? 'pp-conge-ok' : 'pp-conge-wait'}`}>
                              <span>🌴</span>
                              <span className="pp-conge-label">{conge.statut === 'approuve' ? 'Congé' : 'En attente'}</span>
                            </div>
                          ) : (
                            <>
                              {/* Heures */}
                              {plan && (
                                <div className={`pp-hours${plan.fallback ? ' pp-hours-fallback' : ''}`}>
                                  {plan.heure_debut.slice(0, 5)}–{plan.heure_fin.slice(0, 5)}
                                </div>
                              )}

                              {/* Tâches — cliquables en mode édition */}
                              {dayTaches.map(t => {
                                const cfg = TACHES_CFG[t.tache] || TACHES_CFG.autre
                                return (
                                  <div
                                    key={t.id}
                                    className={`pp-tache pp-tache-${cfg.color}${editMode ? ' pp-tache-click' : ''}`}
                                    title={editMode ? 'Cliquer pour modifier' : (t.note || cfg.label)}
                                    onClick={() => editMode && openEdit(t, u.name)}
                                  >
                                    <span className="pp-tache-icon">{cfg.icon}</span>
                                    <span className="pp-tache-body">
                                      <span className="pp-tache-label">{cfg.label}</span>
                                      {(t.heure_debut || t.heure_fin) && (
                                        <span className="pp-tache-hours">
                                          {t.heure_debut?.slice(0, 5)}–{t.heure_fin?.slice(0, 5)}
                                        </span>
                                      )}
                                    </span>
                                    {editMode && <span className="pp-tache-edit-dot" aria-hidden="true">✏</span>}
                                  </div>
                                )
                              })}

                              {/* Bouton + en mode édition (non weekend) */}
                              {editMode && !isWE && (
                                <button
                                  className="pp-add-btn"
                                  onClick={() => openNew(u.id, u.name, dateStr)}
                                  title={`Ajouter un créneau — ${u.name} — ${dateStr}`}
                                >
                                  +
                                </button>
                              )}

                              {/* Rien de planifié en lecture */}
                              {!editMode && !plan && dayTaches.length === 0 && (
                                <span className="pp-empty">{isWE ? '—' : ''}</span>
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

      {/* ── Modal édition ───────────────────────────────────────── */}
      {modal && isAdmin && (
        <div className="modal-overlay" onClick={() => !saving && setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{modal.existing ? 'Modifier le créneau' : 'Nouveau créneau'}</h2>
                <p className="pt-modal-sub">
                  {modal.userName} — {format(new Date(modal.dateStr + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <button className="btn btn-ghost" onClick={() => setModal(null)} disabled={saving}>✕</button>
            </div>

            <div className="modal-body">
              {err && <div className="error-msg">{err}</div>}

              {/* Sélecteur de type */}
              <div className="form-group">
                <label>Type de poste</label>
                <div className="pp-type-grid">
                  {Object.entries(TACHES_CFG).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      className={`pp-type-btn pp-type-${v.color}${fType === k ? ' active' : ''}`}
                      onClick={() => setFType(k)}
                    >
                      <span className="pp-type-icon">{v.icon}</span>
                      <span>{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Heures */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Heure de début</label>
                  <input type="time" value={fDebut} onChange={e => setFDebut(e.target.value)} disabled={saving} />
                </div>
                <div className="form-group">
                  <label>Heure de fin</label>
                  <input type="time" value={fFin} onChange={e => setFFin(e.target.value)} disabled={saving} />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              {modal.existing && (
                <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                  Supprimer
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setModal(null)} disabled={saving}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Sauvegarde…' : modal.existing ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
