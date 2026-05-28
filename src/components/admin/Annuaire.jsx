import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getUsers } from '../../lib/localData'
import { getPlanningByUser, getCongesByUser } from '../../lib/db'
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

const timeToMin = t => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m }
const minToHHMM = m => { const h = Math.floor(m / 60); return `${h}h${String(m % 60).padStart(2, '0')}` }

function PanelContent({ user: emp }) {
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
      {/* Avatar + nom */}
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

      {/* Onglets */}
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
          <dl className="ann-info-list">
            <div className="ann-info-row">
              <dt>Type de contrat</dt>
              <dd>{emp.type_contrat || '—'}</dd>
            </div>
            <div className="ann-info-row">
              <dt>Taux d'activité</dt>
              <dd>{emp.taux_activite != null ? `${emp.taux_activite} %` : '—'}</dd>
            </div>
            <div className="ann-info-row">
              <dt>Heures hebdo.</dt>
              <dd>{emp.heures_hebdo != null ? `${emp.heures_hebdo} h` : '—'}</dd>
            </div>
            <div className="ann-info-row">
              <dt>Début du contrat</dt>
              <dd>{emp.date_entree ? format(new Date(emp.date_entree), 'dd MMMM yyyy', { locale: fr }) : '—'}</dd>
            </div>
            <div className="ann-info-row">
              <dt>Ancienneté</dt>
              <dd>{anciennete !== null ? `${anciennete} an${anciennete !== 1 ? 's' : ''}` : '—'}</dd>
            </div>
          </dl>
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
  const { user } = useAuth()
  const users    = getUsers()
  const [selected, setSelected] = useState(null)

  const handleKey = e => { if (e.key === 'Escape') setSelected(null) }

  return (
    <div className="ann-wrap" onKeyDown={handleKey}>
      <Breadcrumb items={['Cabinet Médical', 'Annuaire']} />

      <div className="card ann-header-card">
        <h2 className="section-title">Annuaire de l'équipe</h2>
        <p className="ann-count">{users.length} collaborateur{users.length > 1 ? 's' : ''}</p>
      </div>

      {/* Grille des fiches */}
      <div className="ann-grid">
        {users.map(emp => (
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
        ))}
      </div>

      {/* Panneau latéral droit */}
      {selected && (
        <>
          <div className="ann-overlay" onClick={() => setSelected(null)} />
          <aside className="ann-panel" role="dialog" aria-label={`Fiche de ${selected.name}`}>
            <button className="ann-panel-close" onClick={() => setSelected(null)} aria-label="Fermer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <PanelContent user={selected} />
          </aside>
        </>
      )}
    </div>
  )
}
