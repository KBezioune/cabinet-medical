import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getUsers } from '../../lib/localData'
import { getPlanningByUser, getCongesByUser, getUserContract, updateUserContract } from '../../lib/db'
import { format, differenceInYears } from 'date-fns'
import { fr } from 'date-fns/locale'
import Breadcrumb from '../shared/Breadcrumb'
import './Annuaire.css'

const ROLE_LABEL = { admin: 'Médecin', manager: 'Manager', assistant: 'Assistante médicale' }
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const CONGE_STATUT = {
  en_attente: { label: 'En attente', cls: 'wait' },
  approuve:   { label: 'Approuvé',   cls: 'ok'   },
  refuse:     { label: 'Refusé',     cls: 'ko'   },
}

const CONGE_TYPES = {
  vacances:   { label: 'Vacances',   icon: '🌴' },
  maladie:    { label: 'Maladie',    icon: '🏥' },
  conge:      { label: 'Congé',      icon: '📋' },
  formation:  { label: 'Formation',  icon: '📚' },
  absence:    { label: 'Absence',    icon: '📝' },
}

const TYPE_CONTRAT_OPTIONS = ['CDI', 'CDD', 'Temps partiel', 'Indépendant', 'Stage']

const timeToMin = t => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m }
const minToHHMM = m => { const h = Math.floor(m / 60); return `${h}h${String(m % 60).padStart(2, '0')}` }

function ContratTab({ emp, isAdmin }) {
  const [contract, setContract] = useState({
    type_contrat:   emp.type_contrat    || 'CDI',
    taux_activite:  emp.taux_activite   ?? 100,
    heures_par_jour: emp.heures_par_jour ?? 6,
    date_entree:    emp.date_entree     || '',
    droit_vacances: emp.droit_vacances  ?? 25,
    salaire_brut:   emp.salaire_brut    || '',
  })
  const [editing, setEditing]   = useState(false)
  const [saving,  setSaving]    = useState(false)
  const [saved,   setSaved]     = useState(false)
  const [err,     setErr]       = useState('')

  useEffect(() => {
    getUserContract(emp.id).then(data => {
      if (data) {
        setContract(prev => ({
          ...prev,
          ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null)),
        }))
      }
    }).catch(() => {})
  }, [emp.id])

  const anciennete = contract.date_entree
    ? differenceInYears(new Date(), new Date(contract.date_entree))
    : null

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    try {
      await updateUserContract(emp.id, {
        type_contrat:    contract.type_contrat,
        taux_activite:   Number(contract.taux_activite),
        heures_par_jour: Number(contract.heures_par_jour),
        date_entree:     contract.date_entree || null,
        droit_vacances:  Number(contract.droit_vacances),
        salaire_brut:    contract.salaire_brut ? Number(contract.salaire_brut) : null,
      })
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setErr(e?.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const field = (label, key, type = 'text', extra = {}) => (
    <div className="ann-info-row">
      <dt>{label}</dt>
      <dd>
        {editing && isAdmin
          ? type === 'select'
            ? (
              <select
                className="ann-input"
                value={contract[key]}
                onChange={e => setContract(p => ({ ...p, [key]: e.target.value }))}
              >
                {extra.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )
            : (
              <input
                className="ann-input"
                type={type}
                value={contract[key]}
                min={extra.min}
                max={extra.max}
                onChange={e => setContract(p => ({ ...p, [key]: e.target.value }))}
              />
            )
          : formatFieldValue(key, contract[key], anciennete)
        }
      </dd>
    </div>
  )

  return (
    <div>
      {isAdmin && (
        <div className="ann-contrat-actions">
          {!editing
            ? (
              <button className="btn btn-secondary ann-edit-btn" onClick={() => setEditing(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Modifier
              </button>
            )
            : (
              <div className="ann-edit-btns">
                <button className="btn btn-secondary" onClick={() => { setEditing(false); setErr('') }}>Annuler</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            )
          }
          {saved && <span className="ann-saved">✓ Sauvegardé</span>}
          {err   && <span className="ann-err">{err}</span>}
        </div>
      )}

      <dl className="ann-info-list">
        {field('Type de contrat',    'type_contrat',    'select', { options: TYPE_CONTRAT_OPTIONS })}
        {field("Taux d'activité (%)", 'taux_activite',  'number', { min: 0, max: 100 })}
        {field('Heures / jour',      'heures_par_jour', 'number', { min: 1, max: 24 })}
        {field('Date d\'entrée',     'date_entree',     'date')}
        {field('Vacances (j/an)',    'droit_vacances',  'number', { min: 0, max: 50 })}
        {field('Salaire brut (CHF)', 'salaire_brut',    'number', { min: 0 })}
        {anciennete !== null && (
          <div className="ann-info-row">
            <dt>Ancienneté</dt>
            <dd>{anciennete} an{anciennete !== 1 ? 's' : ''}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

function formatFieldValue(key, val, anciennete) {
  if (!val && val !== 0) return '—'
  switch (key) {
    case 'taux_activite':   return `${val} %`
    case 'heures_par_jour': return `${val} h/jour`
    case 'droit_vacances':  return `${val} jours/an`
    case 'salaire_brut':    return `CHF ${Number(val).toLocaleString('fr-CH')}`
    case 'date_entree':     return format(new Date(val), 'dd MMMM yyyy', { locale: fr })
    default:                return String(val)
  }
}

function PanelContent({ user: emp, canEditContracts }) {
  const [tab,      setTab]      = useState('info')
  const [planning, setPlanning] = useState([])
  const [conges,   setConges]   = useState([])
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (tab !== 'planning' && tab !== 'conges') return
    setLoading(true)
    Promise.all([getPlanningByUser(emp.id), getCongesByUser(emp.id)])
      .then(([pl, cg]) => { setPlanning(pl); setConges(cg) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [tab, emp.id])

  const anciennete = emp.date_entree
    ? differenceInYears(new Date(), new Date(emp.date_entree))
    : null

  return (
    <div className="ann-panel-inner">
      <div className="ann-panel-hero">
        <div className="ann-panel-avatar" style={{ background: emp.color }}>
          {emp.name[0]}
        </div>
        <div>
          <h2 className="ann-panel-name">{emp.name}</h2>
          <p className="ann-panel-poste">{emp.poste || ROLE_LABEL[emp.role]}</p>
          <span className={`ann-role-badge ann-role-${emp.role}`}>{ROLE_LABEL[emp.role]}</span>
        </div>
      </div>

      <div className="ann-panel-tabs">
        {[['info','Informations'],['contrat','Contrat'],['planning','Planning'],['conges','Congés']].map(([id, lbl]) => (
          <button key={id} className={`ann-panel-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
            {lbl}
          </button>
        ))}
      </div>

      <div className="ann-panel-body">
        {tab === 'info' && (
          <dl className="ann-info-list">
            <div className="ann-info-row">
              <dt>Téléphone</dt>
              <dd><a href={`tel:${emp.phone}`}>{emp.phone || '—'}</a></dd>
            </div>
            <div className="ann-info-row">
              <dt>E-mail</dt>
              <dd><a href={`mailto:${emp.email}`}>{emp.email || '—'}</a></dd>
            </div>
            <div className="ann-info-row">
              <dt>Date d'entrée</dt>
              <dd>
                {emp.date_entree
                  ? format(new Date(emp.date_entree), 'dd MMMM yyyy', { locale: fr })
                  : '—'}
                {anciennete !== null && <span className="ann-anciennete">&nbsp;({anciennete} an{anciennete !== 1 ? 's' : ''})</span>}
              </dd>
            </div>
            <div className="ann-info-row">
              <dt>Taux d'activité</dt>
              <dd>{emp.taux_activite != null ? `${emp.taux_activite} %` : '—'}</dd>
            </div>
            <div className="ann-info-row">
              <dt>Rôle</dt>
              <dd>{ROLE_LABEL[emp.role]}</dd>
            </div>
          </dl>
        )}

        {tab === 'contrat' && (
          <ContratTab emp={emp} isAdmin={canEditContracts} />
        )}

        {tab === 'planning' && (
          loading ? <div className="loading-center"><div className="spinner" /></div> :
          planning.length === 0
            ? <p className="ann-empty">Aucun planning configuré.</p>
            : (
              <table className="ann-planning-table">
                <thead>
                  <tr><th>Jour</th><th>Début</th><th>Fin</th><th>Durée</th></tr>
                </thead>
                <tbody>
                  {JOURS.map((j, i) => {
                    const row = planning.find(p => p.jour_semaine === i + 1)
                    if (!row?.actif) return null
                    const dur = timeToMin(row.heure_fin) - timeToMin(row.heure_debut)
                    return (
                      <tr key={i}>
                        <td className="ann-jour">{j}</td>
                        <td>{row.heure_debut?.slice(0,5)}</td>
                        <td>{row.heure_fin?.slice(0,5)}</td>
                        <td><span className="badge badge-blue">{minToHHMM(dur)}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
        )}

        {tab === 'conges' && (
          loading ? <div className="loading-center"><div className="spinner" /></div> :
          conges.length === 0
            ? <p className="ann-empty">Aucun congé enregistré.</p>
            : (
              <div className="ann-conges-list">
                {conges.slice(0, 10).map(c => {
                  const st  = CONGE_STATUT[c.statut] || CONGE_STATUT.en_attente
                  const typ = CONGE_TYPES[c.type]    || { label: c.type, icon: '📋' }
                  return (
                    <div key={c.id} className="ann-conge-item">
                      <span className="ann-conge-icon">{typ.icon}</span>
                      <div className="ann-conge-info">
                        <span className="ann-conge-type">{typ.label}</span>
                        <span className="ann-conge-dates">
                          {format(new Date(c.date_debut + 'T12:00:00'), 'dd MMM', { locale: fr })}
                          {' → '}
                          {format(new Date(c.date_fin + 'T12:00:00'), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                      <span className={`ann-conge-statut ann-cst-${st.cls}`}>{st.label}</span>
                    </div>
                  )
                })}
              </div>
            )
        )}
      </div>
    </div>
  )
}

export default function Annuaire() {
  const { user }   = useAuth()
  const users      = getUsers()
  const [selected, setSelected] = useState(null)

  const isAdmin    = user.role === 'admin'
  const handleKey  = e => { if (e.key === 'Escape') setSelected(null) }

  const contractSummary = (emp) => {
    const parts = []
    if (emp.taux_activite != null)  parts.push(`${emp.taux_activite}%`)
    if (emp.heures_par_jour != null) parts.push(`${emp.heures_par_jour}h/j`)
    if (emp.droit_vacances != null)  parts.push(`${emp.droit_vacances}j/an`)
    return parts.join(' · ')
  }

  return (
    <div className="ann-wrap" onKeyDown={handleKey}>
      <Breadcrumb items={['Cabinet Médical', 'Annuaire']} />

      <div className="card ann-header-card">
        <h2 className="section-title">Annuaire de l'équipe</h2>
        <p className="ann-count">{users.length} collaborateur{users.length > 1 ? 's' : ''}</p>
      </div>

      <div className="ann-grid">
        {users.map(emp => {
          const summary = contractSummary(emp)
          return (
            <button
              key={emp.id}
              className={`ann-card${selected?.id === emp.id ? ' ann-card-active' : ''}`}
              onClick={() => setSelected(s => s?.id === emp.id ? null : emp)}
            >
              <div className="ann-card-avatar" style={{ background: emp.color }}>
                {emp.name[0]}
              </div>
              <div className="ann-card-info">
                <span className="ann-card-name">{emp.name}</span>
                <span className="ann-card-poste">{emp.poste || ROLE_LABEL[emp.role]}</span>
                {summary && <span className="ann-card-summary">{summary}</span>}
              </div>
              <div className="ann-card-meta">
                {emp.taux_activite != null && (
                  <span className="ann-taux">{emp.taux_activite} %</span>
                )}
                <span className={`ann-role-dot ann-role-${emp.role}`} />
              </div>
              <div className="ann-card-contact">
                {emp.phone && <span className="ann-card-phone">{emp.phone}</span>}
                {emp.email && <span className="ann-card-email">{emp.email}</span>}
              </div>
            </button>
          )
        })}
      </div>

      {selected && (
        <>
          <div className="ann-overlay" onClick={() => setSelected(null)} />
          <aside className="ann-panel" role="dialog" aria-label={`Fiche de ${selected.name}`}>
            <button className="ann-panel-close" onClick={() => setSelected(null)} aria-label="Fermer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <PanelContent user={selected} canEditContracts={isAdmin} />
          </aside>
        </>
      )}
    </div>
  )
}
