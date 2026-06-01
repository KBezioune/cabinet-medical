import { useState, useEffect } from 'react'
import { getUsers } from '../../lib/localData'
import { useAuth } from '../../contexts/AuthContext'
import {
  getPlanningForUsers, getAllConges,
  getPlanningShifts, upsertPlanningShift, deletePlanningShift,
  getPlanningTasks, insertPlanningTask, updatePlanningTask, deletePlanningTask,
} from '../../lib/db'
import { JOURS, getWeekDays } from '../../utils/dateUtils'
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import Breadcrumb from './Breadcrumb'
import './PlanningPartage.css'

// Conservé pour les créneaux (type_poste)
const TACHES_CFG = {
  consultation:  { label: 'Consultation',  icon: '🩺', color: 'blue'   },
  sterilisation: { label: 'Stérilisation', icon: '🧴', color: 'teal'   },
  accueil:       { label: 'Accueil',       icon: '😊', color: 'green'  },
  administratif: { label: 'Administratif', icon: '📋', color: 'orange' },
  autre:         { label: 'Autre',         icon: '📌', color: 'gray'   },
  conge:         { label: 'Congé',         icon: '🌴', color: 'conge'  },
}

const ROLE_LABEL    = { admin: 'Médecin', manager: 'Manager', assistant: 'Assistante' }
const DEFAULT_DEBUT = '08:00'
const DEFAULT_FIN   = '17:00'
const DEFAULT_MATIN = '08:00–12:00'
const DEFAULT_APREM = '14:00–17:00'

function isMissingTable(err) {
  return err?.message?.includes('does not exist') || err?.code === '42P01'
}

const SQL_SHIFTS = `CREATE TABLE planning_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  heure_debut TIME,
  heure_fin TIME,
  type_poste TEXT DEFAULT 'consultation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);
ALTER TABLE planning_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON planning_shifts FOR ALL USING (true);`

export default function PlanningPartage() {
  const { user }  = useAuth()
  const isAdmin   = user?.role === 'admin'

  // ── Vues ────────────────────────────────────────────────────
  const [viewMode,  setViewMode]  = useState('semaine')
  const [weekRef,   setWeekRef]   = useState(new Date())
  const [monthRef,  setMonthRef]  = useState(new Date())

  // ── Données ──────────────────────────────────────────────────
  const [planning,      setPlanning]      = useState([])
  const [tasks,         setTasks]         = useState([])  // planning_tasks (texte libre)
  const [conges,        setConges]        = useState([])
  const [shifts,        setShifts]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [noShiftTable,  setNoShiftTable]  = useState(false)
  const [reloadKey,     setReloadKey]     = useState(0)

  // ── Mode édition créneaux ─────────────────────────────────────
  const [editMode,  setEditMode]  = useState(false)
  const [sqlCopied, setSqlCopied] = useState(false)

  // ── Modal tâche libre (planning_tasks) ───────────────────────
  const [taskModal, setTaskModal] = useState(null) // { userId, userName, dateStr, existing }
  const [fTexte,    setFTexte]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  // ── Modal créneau shift (planning_shifts) ───────────────────
  const [shiftModal, setShiftModal] = useState(null)
  const [sfType,  setSfType]  = useState('consultation')
  const [sfDebut, setSfDebut] = useState(DEFAULT_DEBUT)
  const [sfFin,   setSfFin]   = useState(DEFAULT_FIN)
  const [sfSaving,setSfSaving] = useState(false)
  const [sfErr,   setSfErr]   = useState('')

  const users      = getUsers()
  const weekDays   = getWeekDays(weekRef)
  const today      = format(new Date(), 'yyyy-MM-dd')
  const monthStart = startOfMonth(monthRef)
  const monthEnd   = endOfMonth(monthRef)
  const monthDays  = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // ── Chargement données ───────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const ids  = users.map(u => u.id)
      let from, to
      if (viewMode === 'semaine') {
        from = format(weekDays[0], 'yyyy-MM-dd')
        to   = format(weekDays[6], 'yyyy-MM-dd')
      } else {
        from = format(monthStart, 'yyyy-MM-dd')
        to   = format(monthEnd,   'yyyy-MM-dd')
      }
      try {
        const [pl, tsk, cg] = await Promise.all([
          getPlanningForUsers(ids),
          getPlanningTasks(ids, from, to).catch(() => []),
          getAllConges(),
        ])
        setPlanning(pl); setTasks(tsk); setConges(cg)
      } catch (e) { console.error(e) }

      try {
        const sh = await getPlanningShifts(ids, from, to)
        setShifts(sh); setNoShiftTable(false)
      } catch (e) {
        if (isMissingTable(e)) setNoShiftTable(true)
        else console.error(e)
      }
      setLoading(false)
    }
    load()
  }, [weekRef, monthRef, viewMode, reloadKey])

  // ── Helpers données ──────────────────────────────────────────
  const getDayShift = (userId, dateStr) =>
    shifts.find(s => s.user_id === userId && s.date === dateStr) || null

  const getDayPlan = (userId, day) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const shift = getDayShift(userId, dateStr)
    if (shift) return {
      heure_debut: shift.heure_debut?.slice(0, 5),
      heure_fin:   shift.heure_fin?.slice(0, 5),
      type_poste:  shift.type_poste,
      isShift:     true,
      shiftObj:    shift,
    }
    const jourSem = getDay(day) === 0 ? 7 : getDay(day)
    const found   = planning.find(p => p.user_id === userId && p.jour_semaine === jourSem && p.actif)
    if (found) return found
    if (jourSem >= 1 && jourSem <= 5 && jourSem !== 3)
      return { heure_debut: DEFAULT_DEBUT, heure_fin: DEFAULT_FIN, fallback: true }
    return null
  }

  const getDayTasks = (userId, dateStr) =>
    tasks.filter(t => t.user_id === userId && t.date === dateStr)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))

  const getDayConge = (userId, dateStr) =>
    conges.find(c =>
      c.user_id === userId &&
      c.date_debut <= dateStr && c.date_fin >= dateStr &&
      c.statut !== 'refuse'
    ) || null

  // ── Handlers tâches libres ───────────────────────────────────
  const openTaskNew = (userId, userName, dateStr) => {
    setTaskModal({ userId, userName, dateStr, existing: null })
    setFTexte(''); setErr('')
  }
  const openTaskEdit = (task, userName) => {
    setTaskModal({ userId: task.user_id, userName, dateStr: task.date, existing: task })
    setFTexte(task.texte || ''); setErr('')
  }
  const handleTaskSave = async () => {
    if (!fTexte.trim()) { setErr('Le texte de la tâche est requis.'); return }
    setSaving(true); setErr('')
    try {
      if (taskModal.existing) {
        await updatePlanningTask(taskModal.existing.id, { texte: fTexte.trim() })
      } else {
        await insertPlanningTask({ user_id: taskModal.userId, date: taskModal.dateStr, texte: fTexte.trim() })
      }
      setTaskModal(null); setReloadKey(k => k + 1)
    } catch (e) { setErr(e.message || 'Erreur') }
    finally { setSaving(false) }
  }
  const handleTaskDelete = async () => {
    setSaving(true); setErr('')
    try {
      await deletePlanningTask(taskModal.existing.id)
      setTaskModal(null); setReloadKey(k => k + 1)
    } catch (e) { setErr(e.message || 'Erreur') }
    finally { setSaving(false) }
  }

  // ── Handlers créneaux shifts ─────────────────────────────────
  const openShiftNew = (u, dateStr) => {
    setShiftModal({ userId: u.id, userName: u.name, dateStr, existing: null })
    setSfType('consultation'); setSfDebut(DEFAULT_DEBUT); setSfFin(DEFAULT_FIN); setSfErr('')
  }
  const openShiftEdit = (u, dateStr, plan) => {
    setShiftModal({ userId: u.id, userName: u.name, dateStr, existing: plan?.shiftObj || null })
    setSfType(plan?.type_poste || 'consultation')
    setSfDebut(plan?.heure_debut?.slice(0, 5) || DEFAULT_DEBUT)
    setSfFin(plan?.heure_fin?.slice(0, 5)     || DEFAULT_FIN)
    setSfErr('')
  }
  const handleShiftSave = async () => {
    setSfSaving(true); setSfErr('')
    try {
      await upsertPlanningShift({
        user_id:     shiftModal.userId,
        date:        shiftModal.dateStr,
        heure_debut: sfDebut || null,
        heure_fin:   sfFin   || null,
        type_poste:  sfType,
      })
      setShiftModal(null); setReloadKey(k => k + 1)
    } catch (e) {
      if (isMissingTable(e)) setNoShiftTable(true)
      setSfErr(e.message || 'Erreur')
    } finally { setSfSaving(false) }
  }
  const handleShiftDelete = async () => {
    if (!shiftModal.existing) { setShiftModal(null); return }
    setSfSaving(true); setSfErr('')
    try {
      await deletePlanningShift(shiftModal.userId, shiftModal.dateStr)
      setShiftModal(null); setReloadKey(k => k + 1)
    } catch (e) { setSfErr(e.message || 'Erreur') }
    finally { setSfSaving(false) }
  }

  const copySql = () => {
    navigator.clipboard?.writeText(SQL_SHIFTS).then(() => {
      setSqlCopied(true); setTimeout(() => setSqlCopied(false), 2000)
    })
  }

  const weekLabel  = `${format(weekDays[0], 'dd MMM', { locale: fr })} – ${format(weekDays[6], 'dd MMM yyyy', { locale: fr })}`
  const monthLabel = format(monthRef, 'MMMM yyyy', { locale: fr })

  return (
    <div className="pp-wrap">
      <Breadcrumb items={['Cabinet Médical', 'Planning', 'Planning équipe']} />

      <div className="card pp-card">

        {/* ── Bannière mode édition créneaux ─────────────────── */}
        {editMode && (
          <div className="pp-edit-banner">
            <span className="pp-edit-banner-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Mode édition créneaux — cliquez sur un créneau pour le modifier
            </span>
            <div className="pp-edit-banner-btns">
              <button className="btn btn-outline pp-banner-btn" onClick={() => { setEditMode(false); setShiftModal(null) }}>
                Annuler
              </button>
              <button className="btn btn-primary pp-banner-btn" onClick={() => { setEditMode(false); setShiftModal(null) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Terminer
              </button>
            </div>
          </div>
        )}

        {/* ── En-tête ──────────────────────────────────────────── */}
        <div className="pp-header">
          <div>
            <h2 className="pp-title">Planning de l'équipe</h2>
            <p className="pp-subtitle">
              {viewMode === 'mois'  ? 'Vue mensuelle · lecture seule'
                : editMode         ? '✏️ Créneaux cliquables — modifications en temps réel'
                : isAdmin          ? '📌 Cliquez sur + Tâche pour assigner des tâches'
                : 'Vue semaine · lecture seule'}
            </p>
          </div>
          <div className="pp-header-right">
            <div className="pp-view-toggle">
              <button className={`pp-view-btn${viewMode === 'semaine' ? ' active' : ''}`} onClick={() => { setViewMode('semaine'); setEditMode(false) }}>Semaine</button>
              <button className={`pp-view-btn${viewMode === 'mois'    ? ' active' : ''}`} onClick={() => { setViewMode('mois');    setEditMode(false) }}>Mois</button>
            </div>

            {isAdmin && viewMode === 'semaine' && !editMode && (
              <button className="btn btn-outline pp-edit-btn" onClick={() => setEditMode(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Modifier créneaux
              </button>
            )}

            {viewMode === 'semaine' ? (
              <div className="pp-nav">
                <button className="btn btn-outline pp-btn-nav" onClick={() => setWeekRef(d => subWeeks(d, 1))}>← Préc.</button>
                <span className="pp-week-label">{weekLabel}</span>
                <button className="btn btn-outline pp-btn-nav" onClick={() => setWeekRef(d => addWeeks(d, 1))}>Suiv. →</button>
              </div>
            ) : (
              <div className="pp-nav">
                <button className="btn btn-outline pp-btn-nav" onClick={() => setMonthRef(d => subMonths(d, 1))}>← Préc.</button>
                <span className="pp-week-label" style={{ textTransform: 'capitalize' }}>{monthLabel}</span>
                <button className="btn btn-outline pp-btn-nav" onClick={() => setMonthRef(d => addMonths(d, 1))}>Suiv. →</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Avertissement table planning_shifts manquante ───── */}
        {noShiftTable && editMode && (
          <div className="pp-no-table-warn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>La table <code>planning_shifts</code> n'existe pas encore.</span>
            <button className="btn btn-outline pp-banner-btn" onClick={copySql}>{sqlCopied ? '✓ Copié !' : 'Copier le SQL'}</button>
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>

        ) : viewMode === 'mois' ? (
          /* ── Vue mensuelle ──────────────────────────────────── */
          <div className="pp-table-wrap">
            <table className="pp-table pp-month-table">
              <thead>
                <tr>
                  <th className="pp-th-user">Collaborateur</th>
                  {monthDays.map((day, i) => {
                    const ds = format(day, 'yyyy-MM-dd'), isToday = ds === today, isWE = getDay(day) === 0 || getDay(day) === 6
                    return (
                      <th key={i} className={`pp-th-day pp-th-month${isToday ? ' pp-th-today' : ''}${isWE ? ' pp-th-we' : ''}`}>
                        <span className="pp-th-jour">{format(day, 'EEE', { locale: fr }).slice(0,2)}</span>
                        <span className="pp-th-date">{format(day, 'd')}</span>
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
                        <span className="pp-user-name">{u.name}</span>
                      </div>
                    </td>
                    {monthDays.map((day, i) => {
                      const ds        = format(day, 'yyyy-MM-dd')
                      const isToday   = ds === today
                      const isWE      = getDay(day) === 0 || getDay(day) === 6
                      const conge     = getDayConge(u.id, ds)
                      const plan      = getDayPlan(u.id, day)
                      const dayTasks  = getDayTasks(u.id, ds)
                      let cellClass = 'pp-month-cell', content = null
                      if (conge) {
                        cellClass += conge.statut === 'approuve' ? ' pp-mc-conge' : ' pp-mc-wait'
                        content = <span title={conge.statut === 'approuve' ? 'Congé approuvé' : 'En attente'}>🌴</span>
                      } else if (isWE) {
                        cellClass += ' pp-mc-we'
                      } else if (dayTasks.length > 0) {
                        cellClass += ' pp-mc-task pp-mc-task-blue'
                        content = <span title={dayTasks.map(t => t.texte).join(', ')}>📌</span>
                      } else if (plan?.isShift) {
                        const cfg = TACHES_CFG[plan.type_poste] || TACHES_CFG.consultation
                        cellClass += ` pp-mc-task pp-mc-task-${cfg.color}`
                        content = <span title={cfg.label}>{cfg.icon}</span>
                      } else if (plan && !plan.fallback) {
                        cellClass += ' pp-mc-planned'; content = <span className="pp-mc-dot" />
                      } else if (plan?.fallback) {
                        cellClass += ' pp-mc-fallback'; content = <span className="pp-mc-dot pp-mc-dot-gray" />
                      }
                      return (
                        <td key={i} className={`pp-td pp-month-td${isToday ? ' pp-td-today' : ''}`}>
                          <div className={cellClass}>{content}</div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        ) : (
          /* ── Vue semaine ────────────────────────────────────── */
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th className="pp-th-user">Collaborateur</th>
                  {weekDays.map((day, i) => {
                    const ds = format(day, 'yyyy-MM-dd'), isToday = ds === today, isWE = i >= 5
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
                      const dateStr  = format(day, 'yyyy-MM-dd')
                      const isToday  = dateStr === today
                      const isWE     = i >= 5
                      const plan     = getDayPlan(u.id, day)
                      const dayTasks = getDayTasks(u.id, dateStr)
                      const conge    = getDayConge(u.id, dateStr)
                      const hasShift = plan?.isShift
                      const hasPlan  = !!plan

                      return (
                        <td
                          key={i}
                          className={`pp-td${isToday ? ' pp-td-today' : ''}${isWE ? ' pp-td-we' : ''}${conge ? ' pp-td-conge' : ''}`}
                        >
                          {conge ? (
                            <div className={`pp-conge ${conge.statut === 'approuve' ? 'pp-conge-ok' : 'pp-conge-wait'}`}>
                              <span>🌴</span>
                              <span className="pp-conge-label">{conge.statut === 'approuve' ? 'Congé' : 'En attente'}</span>
                            </div>
                          ) : (
                            <>
                              {/* ── Bloc horaire (créneau) ── */}
                              {plan && (
                                <div
                                  className={`pp-hours${plan.fallback ? ' pp-hours-fallback' : ''}${hasShift ? ' pp-hours-shift' : ''}${editMode && !isWE ? ' pp-hours-editable' : ''}`}
                                  onClick={() => editMode && !isWE && openShiftEdit(u, dateStr, plan)}
                                  title={editMode && !isWE ? 'Cliquer pour modifier le créneau' : undefined}
                                  role={editMode && !isWE ? 'button' : undefined}
                                  tabIndex={editMode && !isWE ? 0 : undefined}
                                  onKeyDown={e => editMode && !isWE && e.key === 'Enter' && openShiftEdit(u, dateStr, plan)}
                                >
                                  {plan.fallback ? (
                                    <>
                                      <span className="pp-hours-line">{DEFAULT_MATIN}</span>
                                      <span className="pp-hours-line">{DEFAULT_APREM}</span>
                                    </>
                                  ) : (
                                    <span className="pp-hours-line">
                                      {plan.heure_debut?.slice(0, 5)}–{plan.heure_fin?.slice(0, 5)}
                                    </span>
                                  )}
                                  {hasShift && plan.type_poste && (
                                    <span className={`pp-shift-badge pp-tache-${TACHES_CFG[plan.type_poste]?.color || 'gray'}`}>
                                      {TACHES_CFG[plan.type_poste]?.icon}
                                    </span>
                                  )}
                                  {editMode && !isWE && (
                                    <span className="pp-hours-pen" aria-hidden="true">✏</span>
                                  )}
                                </div>
                              )}

                              {/* ── Tâches libres (planning_tasks) ── */}
                              {dayTasks.map(t => (
                                <div
                                  key={t.id}
                                  className={`pp-task-chip${isAdmin ? ' pp-task-click' : ''}`}
                                  title={isAdmin ? 'Cliquer pour modifier' : t.texte}
                                  onClick={() => isAdmin && openTaskEdit(t, u.name)}
                                >
                                  <span className="pp-task-label">📌 {t.texte}</span>
                                  {isAdmin && <span className="pp-task-edit" aria-hidden="true">✏</span>}
                                </div>
                              ))}

                              {/* ── Boutons + Créneau / + Tâche ── */}
                              {editMode && !isWE && !hasPlan && (
                                <button className="pp-add-btn pp-add-shift" onClick={() => openShiftNew(u, dateStr)} title="Ajouter un créneau">
                                  + Créneau
                                </button>
                              )}
                              {isAdmin && !isWE && (
                                <button className="pp-add-btn pp-add-task" onClick={() => openTaskNew(u.id, u.name, dateStr)} title="Ajouter une tâche">
                                  + Tâche
                                </button>
                              )}

                              {!isAdmin && !plan && dayTasks.length === 0 && (
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

      {/* ══ Modal créneau shift ═══════════════════════════════════ */}
      {shiftModal && isAdmin && (
        <div className="modal-overlay" onClick={() => !sfSaving && setShiftModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{shiftModal.existing ? 'Modifier le créneau' : 'Nouveau créneau'}</h2>
                <p className="pt-modal-sub">
                  {shiftModal.userName} — {format(new Date(shiftModal.dateStr + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <button className="btn btn-ghost" onClick={() => setShiftModal(null)} disabled={sfSaving}>✕</button>
            </div>
            <div className="modal-body">
              {sfErr && <div className="error-msg">{sfErr}</div>}
              <div className="form-group">
                <label>Type de poste</label>
                <div className="pp-type-grid">
                  {Object.entries(TACHES_CFG).map(([k, v]) => (
                    <button key={k} type="button"
                      className={`pp-type-btn pp-type-${v.color}${sfType === k ? ' active' : ''}`}
                      onClick={() => setSfType(k)}
                    >
                      <span className="pp-type-icon">{v.icon}</span>
                      <span>{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Heure de début</label>
                  <input type="time" value={sfDebut} onChange={e => setSfDebut(e.target.value)} disabled={sfSaving} />
                </div>
                <div className="form-group">
                  <label>Heure de fin</label>
                  <input type="time" value={sfFin} onChange={e => setSfFin(e.target.value)} disabled={sfSaving} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {shiftModal.existing && (
                <button className="btn btn-danger" onClick={handleShiftDelete} disabled={sfSaving}>Supprimer</button>
              )}
              <button className="btn btn-outline" onClick={() => setShiftModal(null)} disabled={sfSaving}>Annuler</button>
              <button className="btn btn-primary" onClick={handleShiftSave} disabled={sfSaving}>
                {sfSaving ? 'Enregistrement…' : shiftModal.existing ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal tâche libre (planning_tasks) ═══════════════════ */}
      {taskModal && isAdmin && (
        <div className="modal-overlay" onClick={() => !saving && setTaskModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{taskModal.existing ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
                <p className="pt-modal-sub">
                  {taskModal.userName} — {format(new Date(taskModal.dateStr + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <button className="btn btn-ghost" onClick={() => setTaskModal(null)} disabled={saving}>✕</button>
            </div>
            <div className="modal-body">
              {err && <div className="error-msg">{err}</div>}
              <div className="form-group">
                <label>Tâche *</label>
                <input
                  type="text"
                  value={fTexte}
                  onChange={e => setFTexte(e.target.value)}
                  placeholder="Ex : Stérilisation salle 2, Accueil patients, Commande fournitures…"
                  autoFocus
                  disabled={saving}
                  onKeyDown={e => e.key === 'Enter' && !saving && handleTaskSave()}
                />
              </div>
            </div>
            <div className="modal-footer">
              {taskModal.existing && (
                <button className="btn btn-danger" onClick={handleTaskDelete} disabled={saving}>Supprimer</button>
              )}
              <button className="btn btn-outline" onClick={() => setTaskModal(null)} disabled={saving}>Annuler</button>
              <button className="btn btn-primary" onClick={handleTaskSave} disabled={saving}>
                {saving ? 'Enregistrement…' : taskModal.existing ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
