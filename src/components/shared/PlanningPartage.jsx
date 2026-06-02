import { useState, useEffect, useRef, Fragment } from 'react'
import { getUsers } from '../../lib/localData'
import { useAuth } from '../../contexts/AuthContext'
import {
  getPlanningForUsers, getAllConges,
  getPlanningShifts, upsertPlanningShift,
  updatePlanningShiftById, deletePlanningShiftById,
  getPointagesByDateRange,
} from '../../lib/db'
import { JOURS, getWeekDays, calcDuree } from '../../utils/dateUtils'
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'
import { fr } from 'date-fns/locale'
import Breadcrumb from './Breadcrumb'
import './PlanningPartage.css'

const AUTO_REFRESH_MS = 5 * 60 * 1000

const calcDuration = (pt) => {
  if (!pt || !pt.heure_arrivee) return null
  if (!pt.heure_depart) return { inProgress: true, minutes: 0 }
  const min = calcDuree(pt.heure_arrivee, pt.heure_depart)
  return { inProgress: false, minutes: Math.max(0, min ?? 0) }
}

const fmtDur = (dur, short = false) => {
  if (!dur) return null
  if (dur.inProgress) return short ? '…' : 'En cours'
  if (dur.minutes === 0) return null
  const h = Math.floor(dur.minutes / 60)
  const m = dur.minutes % 60
  if (short) return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

const ROLE_LABEL    = { admin: 'Médecin', manager: 'Manager', assistant: 'Assistante' }
const DEFAULT_DEBUT = '08:00'
const DEFAULT_FIN   = '17:00'
const DEFAULT_MATIN = '08:00–12:00'
const DEFAULT_APREM = '14:00–17:00'

const SHIFT_PALETTE = [
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { bg: '#ccfbf1', text: '#0f766e', border: '#5eead4' },
]

const getShiftColor = (label) => {
  if (!label) return SHIFT_PALETTE[0]
  const hash = label.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return SHIFT_PALETTE[hash % SHIFT_PALETTE.length]
}

function isMissingTable(err) {
  return err?.message?.includes('does not exist') || err?.code === '42P01'
}

const SQL_SHIFTS = `-- Ajouter la colonne tache si elle n'existe pas :
ALTER TABLE planning_shifts ADD COLUMN IF NOT EXISTS tache TEXT;`

export default function PlanningPartage() {
  const { user }  = useAuth()
  const isAdmin   = user?.role === 'admin'

  const [viewMode,  setViewMode]  = useState('semaine')
  const [weekRef,   setWeekRef]   = useState(new Date())
  const [monthRef,  setMonthRef]  = useState(new Date())

  const [planning,     setPlanning]     = useState([])
  const [conges,       setConges]       = useState([])
  const [shifts,       setShifts]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [noShiftTable, setNoShiftTable] = useState(false)
  const [reloadKey,    setReloadKey]    = useState(0)

  const [editMode,   setEditMode]   = useState(false)
  const [sqlCopied,  setSqlCopied]  = useState(false)
  const [pointages,  setPointages]  = useState([])
  const intervalRef = useRef(null)

  // Modal créneau
  const [shiftModal, setShiftModal] = useState(null)
  const [sfDebut,  setSfDebut]  = useState(DEFAULT_DEBUT)
  const [sfFin,    setSfFin]    = useState(DEFAULT_FIN)
  const [sfTache,  setSfTache]  = useState('')
  const [sfSaving, setSfSaving] = useState(false)
  const [sfErr,    setSfErr]    = useState('')

  const users      = getUsers()
  const weekDays   = getWeekDays(weekRef)
  const today      = format(new Date(), 'yyyy-MM-dd')
  const isCurrentWeek = viewMode === 'semaine' && weekDays.some(d => format(d, 'yyyy-MM-dd') === today)
  const workDays      = weekDays.slice(0, 6)
  const getPointage   = (userId, day) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return pointages.find(p => p.user_id === userId && p.date === dateStr)
  }
  const monthStart = startOfMonth(monthRef)
  const monthEnd   = endOfMonth(monthRef)
  const monthDays  = eachDayOfInterval({ start: monthStart, end: monthEnd })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const ids  = users.map(u => u.id)
      const from = viewMode === 'semaine' ? format(weekDays[0], 'yyyy-MM-dd') : format(monthStart, 'yyyy-MM-dd')
      const to   = viewMode === 'semaine' ? format(weekDays[6], 'yyyy-MM-dd') : format(monthEnd,   'yyyy-MM-dd')
      try {
        const [pl, cg] = await Promise.all([getPlanningForUsers(ids), getAllConges()])
        setPlanning(pl); setConges(cg)
      } catch (e) { console.error(e) }
      try {
        const sh = await getPlanningShifts(ids, from, to)
        setShifts(sh); setNoShiftTable(false)
      } catch (e) {
        if (isMissingTable(e)) setNoShiftTable(true)
        else console.error(e)
      }
      if (viewMode === 'semaine') {
        try {
          const pts = await getPointagesByDateRange(ids, from, to)
          setPointages(pts)
        } catch { /* silencieux */ }
      }
      setLoading(false)
    }
    load()
  }, [weekRef, monthRef, viewMode, reloadKey])

  // Auto-refresh toutes les 5 min (semaine uniquement)
  useEffect(() => {
    if (viewMode !== 'semaine') { clearInterval(intervalRef.current); return }
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => setReloadKey(k => k + 1), AUTO_REFRESH_MS)
    return () => clearInterval(intervalRef.current)
  }, [viewMode, weekRef])

  const getDayShifts = (userId, dateStr) =>
    shifts.filter(s => s.user_id === userId && s.date === dateStr)
      .sort((a, b) => (a.heure_debut || '').localeCompare(b.heure_debut || ''))

  const getDayPlan = (userId, day) => {
    const jourSem = getDay(day) === 0 ? 7 : getDay(day)
    const found   = planning.find(p => p.user_id === userId && p.jour_semaine === jourSem && p.actif)
    if (found) return found
    if (jourSem >= 1 && jourSem <= 5 && jourSem !== 3)
      return { heure_debut: DEFAULT_DEBUT, heure_fin: DEFAULT_FIN, fallback: true }
    return null
  }

  const getDayConge = (userId, dateStr) =>
    conges.find(c =>
      c.user_id === userId &&
      c.date_debut <= dateStr && c.date_fin >= dateStr &&
      c.statut !== 'refuse'
    ) || null

  const openShiftNew = (u, dateStr) => {
    setShiftModal({ userId: u.id, userName: u.name, dateStr, existing: null })
    setSfDebut(DEFAULT_DEBUT); setSfFin(DEFAULT_FIN); setSfTache(''); setSfErr('')
  }
  const openShiftEdit = (u, dateStr, shift) => {
    setShiftModal({ userId: u.id, userName: u.name, dateStr, existing: shift })
    setSfDebut(shift?.heure_debut?.slice(0, 5) || DEFAULT_DEBUT)
    setSfFin(shift?.heure_fin?.slice(0, 5)     || DEFAULT_FIN)
    setSfTache(shift?.tache || shift?.type_poste || '')
    setSfErr('')
  }
  const handleShiftSave = async () => {
    setSfSaving(true); setSfErr('')
    try {
      const payload = { heure_debut: sfDebut || null, heure_fin: sfFin || null, tache: sfTache.trim() || null }
      if (shiftModal.existing) {
        await updatePlanningShiftById(shiftModal.existing.id, payload)
      } else {
        await upsertPlanningShift({ user_id: shiftModal.userId, date: shiftModal.dateStr, ...payload })
      }
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
      await deletePlanningShiftById(shiftModal.existing.id)
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

        {editMode && (
          <div className="pp-edit-banner">
            <span className="pp-edit-banner-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Mode édition — <strong>+ Créneau</strong> pour ajouter, clic sur un créneau pour modifier/supprimer
            </span>
            <div className="pp-edit-banner-btns">
              <button className="btn btn-outline pp-banner-btn" onClick={() => { setEditMode(false); setShiftModal(null) }}>Annuler</button>
              <button className="btn btn-primary pp-banner-btn" onClick={() => { setEditMode(false); setShiftModal(null) }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Terminer
              </button>
            </div>
          </div>
        )}

        <div className="pp-header">
          <div>
            <h2 className="pp-title">Planning de l'équipe</h2>
            <p className="pp-subtitle">
              {viewMode === 'mois' ? 'Vue mensuelle · lecture seule'
                : editMode ? '✏️ Cliquez sur un créneau existant ou + Créneau pour ajouter horaire + tâche'
                : 'Vue semaine · cliquez sur "Modifier créneaux" pour éditer'}
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

        {noShiftTable && editMode && (
          <div className="pp-no-table-warn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>La table <code>planning_shifts</code> ou la colonne <code>tache</code> est manquante.</span>
            <button className="btn btn-outline pp-banner-btn" onClick={copySql}>{sqlCopied ? '✓ Copié !' : 'Copier le SQL'}</button>
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>

        ) : viewMode === 'mois' ? (
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
                      const dayShifts = getDayShifts(u.id, ds)
                      let cellClass = 'pp-month-cell', content = null
                      if (conge) {
                        cellClass += conge.statut === 'approuve' ? ' pp-mc-conge' : ' pp-mc-wait'
                        content = <span title={conge.statut === 'approuve' ? 'Congé approuvé' : 'En attente'}>🌴</span>
                      } else if (isWE) {
                        cellClass += ' pp-mc-we'
                      } else if (dayShifts.length > 0) {
                        cellClass += ' pp-mc-task pp-mc-task-blue'
                        const title = dayShifts.map(s => {
                          const time = `${s.heure_debut?.slice(0,5)}–${s.heure_fin?.slice(0,5)}`
                          return s.tache ? `${time} ${s.tache}` : time
                        }).join(' / ')
                        content = <span title={title}>🕐</span>
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
                {users.map(u => {
                  const todayPt  = isCurrentWeek ? getPointage(u.id, new Date()) : null
                  const todayDur = calcDuration(todayPt)
                  return (
                  <Fragment key={u.id}>
                  <tr className={`pp-row pp-row-${u.role}`}>
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
                      const dayShifts = getDayShifts(u.id, dateStr)
                      const plan      = dayShifts.length > 0 ? null : getDayPlan(u.id, day)
                      const conge     = getDayConge(u.id, dateStr)

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
                              {/* Créneaux avec tâche intégrée */}
                              {dayShifts.map(shift => {
                                const label = shift.tache || shift.type_poste
                                const clr   = getShiftColor(label)
                                const time  = `${shift.heure_debut?.slice(0,5) ?? ''}–${shift.heure_fin?.slice(0,5) ?? ''}`
                                return (
                                  <div
                                    key={shift.id}
                                    className={`pp-shift-chip${editMode && !isWE ? ' pp-shift-chip-edit' : ''}`}
                                    style={{ '--chip-bg': clr.bg, '--chip-text': clr.text, '--chip-border': clr.border }}
                                    onClick={() => editMode && !isWE && openShiftEdit(u, dateStr, shift)}
                                    title={editMode && !isWE ? 'Cliquer pour modifier' : undefined}
                                    role={editMode && !isWE ? 'button' : undefined}
                                    tabIndex={editMode && !isWE ? 0 : undefined}
                                    onKeyDown={e => editMode && !isWE && e.key === 'Enter' && openShiftEdit(u, dateStr, shift)}
                                  >
                                    <span className="pp-shift-chip-time">{time}</span>
                                    {label && <span className="pp-shift-chip-task">{label}</span>}
                                    {editMode && !isWE && <span className="pp-shift-chip-pen" aria-hidden="true">✏</span>}
                                  </div>
                                )
                              })}

                              {/* Fallback horaires hebdo / cabinet */}
                              {plan && (
                                <div className={`pp-hours${plan.fallback ? ' pp-hours-fallback' : ''}`}>
                                  {plan.fallback ? (
                                    <>
                                      <span className="pp-hours-line">{DEFAULT_MATIN}</span>
                                      <span className="pp-hours-line">{DEFAULT_APREM}</span>
                                    </>
                                  ) : (
                                    <span className="pp-hours-line">
                                      {plan.heure_debut?.slice(0,5)}–{plan.heure_fin?.slice(0,5)}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* + Créneau (en mode édition uniquement) */}
                              {editMode && !isWE && (
                                <button className="pp-add-btn pp-add-shift" onClick={() => openShiftNew(u, dateStr)}>
                                  + Créneau
                                </button>
                              )}

                              {!isAdmin && !plan && dayShifts.length === 0 && (
                                <span className="pp-empty">{isWE ? '—' : ''}</span>
                              )}
                            </>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                  {isCurrentWeek && todayDur && (
                    <tr className="pp-daily-row">
                      <td colSpan={weekDays.length + 1}>
                        <span className="pp-daily-text">
                          ⏱{' '}
                          {todayDur.inProgress
                            ? <span className="pp-daily-progress">En cours ▶ — pointage en cours</span>
                            : <><strong className="pp-daily-hours">{fmtDur(todayDur)}</strong> travaillées aujourd'hui</>
                          }
                        </span>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Récapitulatif heures semaine ──────────────────────────── */}
      {!loading && viewMode === 'semaine' && (
        <div className="card pp-recap-card">
          <div className="pp-recap-header">
            <h2 className="pp-title">Récapitulatif heures semaine</h2>
            <span className="pp-recap-sub">Mise à jour auto. toutes les 5 min</span>
          </div>
          <div className="pp-table-wrap">
            <table className="pp-table pp-recap-table">
              <thead>
                <tr>
                  <th className="pp-th-user">Collaborateur</th>
                  {workDays.map((day, i) => {
                    const ds = format(day, 'yyyy-MM-dd')
                    return (
                      <th key={i} className={`pp-th-day${ds === today ? ' pp-th-today' : ''}${i >= 5 ? ' pp-th-we' : ''}`}>
                        <span className="pp-th-jour">{JOURS[i].slice(0, 3)}</span>
                        <span className="pp-th-date">{format(day, 'dd/MM', { locale: fr })}</span>
                      </th>
                    )
                  })}
                  <th className="pp-th-total">Total sem.</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  let totalMin = 0, hasInProgress = false
                  const cells = workDays.map(day => {
                    const pt  = getPointage(u.id, day)
                    const dur = calcDuration(pt)
                    if (dur?.inProgress) hasInProgress = true
                    if (dur && !dur.inProgress) totalMin += dur.minutes
                    return { dur, dateStr: format(day, 'yyyy-MM-dd') }
                  })
                  const h = Math.floor(totalMin / 60), m = totalMin % 60
                  const totalStr = totalMin > 0 ? (m > 0 ? `${h}h ${m}min` : `${h}h`) : null
                  return (
                    <tr key={u.id}>
                      <td className="pp-td-user">
                        <div className="pp-user">
                          <div className={`pp-avatar pp-avatar-${u.role}`}>{u.name[0]}</div>
                          <span className="pp-user-name">{u.name}</span>
                        </div>
                      </td>
                      {cells.map(({ dur, dateStr }, i) => (
                        <td key={i} className={`pp-td pp-recap-day${dateStr === today ? ' pp-td-today' : ''}${i >= 5 ? ' pp-td-we' : ''}`}>
                          {dur
                            ? dur.inProgress
                              ? <span className="pp-recap-progress">En cours ▶</span>
                              : <span className="pp-recap-dur">{fmtDur(dur, true)}</span>
                            : <span className="pp-recap-none">—</span>
                          }
                        </td>
                      ))}
                      <td className="pp-td pp-recap-total-cell">
                        {totalStr || hasInProgress ? (
                          <strong className="pp-recap-total-val">
                            {totalStr ?? '0h'}
                            {hasInProgress && <span className="pp-recap-progress"> +…</span>}
                          </strong>
                        ) : (
                          <span className="pp-recap-none">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ Modal créneau (horaire + tâche) ══════════════════════ */}
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
              <div className="form-group">
                <label>Tâche (optionnel)</label>
                <input
                  type="text"
                  value={sfTache}
                  onChange={e => setSfTache(e.target.value)}
                  placeholder="Ex : Accueil patients, Stérilisation, Prise de sang…"
                  disabled={sfSaving}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && !sfSaving && handleShiftSave()}
                />
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
    </div>
  )
}
