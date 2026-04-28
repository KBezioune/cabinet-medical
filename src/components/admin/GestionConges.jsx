import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getAllConges, updateCongeStatut } from '../../lib/db'
import { getUserById } from '../../lib/localData'
import './GestionConges.css'

const TYPE_LABELS = {
  vacances:  { label: 'Vacances',           emoji: '🌴' },
  maladie:   { label: 'Arrêt maladie',      emoji: '🏥' },
  conge:     { label: 'Congé exceptionnel', emoji: '📋' },
  formation: { label: 'Formation',          emoji: '📚' },
  absence:   { label: 'Absence spéciale',   emoji: '📝' },
}

const STATUT_CONFIG = {
  en_attente: { label: 'En attente', emoji: '⏳', cls: 'statut-attente'  },
  approuve:   { label: 'Approuvé',   emoji: '✅', cls: 'statut-approuve' },
  refuse:     { label: 'Refusé',     emoji: '❌', cls: 'statut-refuse'   },
  modifie:    { label: 'À modifier', emoji: '✏️', cls: 'statut-modifie'  },
}

const FILTERS = ['tous', 'en_attente', 'approuve', 'refuse']

function formatDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function GestionConges() {
  const { user } = useAuth()
  const [conges, setConges]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('en_attente')
  const [modal, setModal]       = useState(null) // conge en cours de traitement
  const [commentaire, setCommentaire] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await getAllConges()
      setConges(data)
    } catch { setError('Impossible de charger les congés.') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = conges.filter(c => filter === 'tous' || c.statut === filter)

  const pendingCount = conges.filter(c => c.statut === 'en_attente').length

  const openModal = (conge) => {
    setModal(conge)
    setCommentaire('')
    setError('')
  }

  const handleDecision = async (statut) => {
    if (!modal) return
    setSaving(true)
    setError('')
    try {
      await updateCongeStatut(modal.id, statut, user.id, commentaire)
      setSuccess(`Demande ${statut === 'approuve' ? 'approuvée' : statut === 'refuse' ? 'refusée' : 'mise à jour'} avec succès.`)
      setModal(null)
      await load()
      setTimeout(() => setSuccess(''), 4000)
    } catch { setError('Erreur lors du traitement. Veuillez réessayer.') }
    setSaving(false)
  }

  return (
    <div className="gc-page">

      <div className="gc-header">
        <div>
          <h2 className="gc-title">Gestion des congés</h2>
          <p className="gc-subtitle">Validez ou refusez les demandes du personnel</p>
        </div>
        {pendingCount > 0 && (
          <div className="pending-badge">
            ⏳ {pendingCount} en attente
          </div>
        )}
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error   && <div className="alert alert-error">{error}</div>}

      {/* FILTRES */}
      <div className="gc-filters">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'tous'       && `Tous (${conges.length})`}
            {f === 'en_attente' && `⏳ En attente (${conges.filter(c=>c.statut==='en_attente').length})`}
            {f === 'approuve'   && `✅ Approuvés (${conges.filter(c=>c.statut==='approuve').length})`}
            {f === 'refuse'     && `❌ Refusés (${conges.filter(c=>c.statut==='refuse').length})`}
          </button>
        ))}
      </div>

      {/* LISTE */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎉</div>
          <p>Aucune demande {filter !== 'tous' ? `"${STATUT_CONFIG[filter]?.label || filter}"` : ''}.</p>
        </div>
      ) : (
        <div className="gc-list">
          {filtered.map(c => {
            const emp    = getUserById(c.user_id)
            const type   = TYPE_LABELS[c.type]    || { label: c.type,   emoji: '📋' }
            const statut = STATUT_CONFIG[c.statut] || { label: c.statut, emoji: '?', cls: '' }

            return (
              <div key={c.id} className={`gc-card ${statut.cls}`}>
                <div className="gc-card-top">
                  <div className="gc-emp">
                    <div className="gc-avatar">{emp?.name?.[0] || '?'}</div>
                    <div>
                      <div className="gc-emp-name">{emp?.name || 'Inconnu'}</div>
                      <div className="gc-emp-role">{
                        emp?.role === 'admin' ? 'Médecin' :
                        emp?.role === 'manager' ? 'Responsable' : 'Assistante médicale'
                      }</div>
                    </div>
                  </div>
                  <div className={`statut-badge ${statut.cls}`}>
                    {statut.emoji} {statut.label}
                  </div>
                </div>

                <div className="gc-card-body">
                  <div className="gc-type">
                    {type.emoji} <strong>{type.label}</strong>
                  </div>
                  <div className="gc-dates">
                    Du <strong>{formatDate(c.date_debut)}</strong> au <strong>{formatDate(c.date_fin)}</strong>
                    <span className="gc-nb-jours"> · {c.nb_jours} jour{c.nb_jours > 1 ? 's' : ''}</span>
                  </div>
                  {c.motif && <div className="gc-motif">💬 {c.motif}</div>}
                  {c.commentaire && (
                    <div className="gc-commentaire-affiche">
                      <strong>Réponse donnée :</strong> {c.commentaire}
                    </div>
                  )}
                  <div className="gc-meta">
                    Soumis le {new Date(c.created_at).toLocaleDateString('fr-CH')}
                    {c.traite_le && ` · Traité le ${new Date(c.traite_le).toLocaleDateString('fr-CH')}`}
                  </div>
                </div>

                {c.statut === 'en_attente' && (
                  <button className="btn-traiter" onClick={() => openModal(c)}>
                    Traiter cette demande →
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL DE TRAITEMENT */}
      {modal && (
        <div className="modal-overlay" onClick={() => !saving && setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            {(() => {
              const emp  = getUserById(modal.user_id)
              const type = TYPE_LABELS[modal.type] || { label: modal.type, emoji: '📋' }
              return (
                <>
                  <div className="modal-header">
                    <h3>Traiter la demande</h3>
                    <button className="modal-close" onClick={() => setModal(null)}>✕</button>
                  </div>

                  <div className="modal-info">
                    <div className="modal-emp">
                      <div className="gc-avatar large">{emp?.name?.[0] || '?'}</div>
                      <div>
                        <div className="modal-emp-name">{emp?.name}</div>
                        <div className="modal-emp-type">{type.emoji} {type.label}</div>
                      </div>
                    </div>
                    <div className="modal-dates">
                      Du <strong>{formatDate(modal.date_debut)}</strong> au <strong>{formatDate(modal.date_fin)}</strong>
                      <span> ({modal.nb_jours} j)</span>
                    </div>
                    {modal.motif && <div className="modal-motif">💬 {modal.motif}</div>}
                  </div>

                  {error && <div className="alert alert-error">{error}</div>}

                  <div className="modal-comment-group">
                    <label>Commentaire <span className="optional">(optionnel)</span></label>
                    <textarea
                      className="form-textarea"
                      placeholder="Expliquez votre décision si nécessaire..."
                      rows={3}
                      value={commentaire}
                      onChange={e => setCommentaire(e.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      className="btn-refuse"
                      onClick={() => handleDecision('refuse')}
                      disabled={saving}
                    >
                      ❌ Refuser
                    </button>
                    <button
                      className="btn-modifier"
                      onClick={() => handleDecision('modifie')}
                      disabled={saving}
                    >
                      ✏️ Demander modif.
                    </button>
                    <button
                      className="btn-approuver"
                      onClick={() => handleDecision('approuve')}
                      disabled={saving}
                    >
                      ✅ Approuver
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
