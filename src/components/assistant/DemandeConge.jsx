import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { insertConge, getCongesByUser, deleteConge, insertNotification } from '../../lib/db'
import { getUsers } from '../../lib/localData'
import './DemandeConge.css'

const TYPE_LABELS = {
  vacances:  { label: 'Vacances',          emoji: '🌴' },
  maladie:   { label: 'Arrêt maladie',     emoji: '🏥' },
  conge:     { label: 'Congé exceptionnel',emoji: '📋' },
  formation: { label: 'Formation',         emoji: '📚' },
  absence:   { label: 'Absence spéciale',  emoji: '📝' },
}

const STATUT_CONFIG = {
  en_attente: { label: 'En attente',emoji: '⏳', cls: 'statut-attente' },
  approuve:   { label: 'Approuvé',  emoji: '✅', cls: 'statut-approuve' },
  refuse:     { label: 'Refusé',    emoji: '❌', cls: 'statut-refuse' },
  modifie:    { label: 'À modifier',emoji: '✏️', cls: 'statut-modifie' },
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' })
}

function nbJours(debut, fin) {
  if (!debut || !fin) return 0
  const d1 = new Date(debut), d2 = new Date(fin)
  return Math.max(0, Math.round((d2 - d1) / 86400000) + 1)
}

export default function DemandeConge() {
  const { user } = useAuth()
  const [conges, setConges]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const [form, setForm] = useState({
    type: 'vacances',
    date_debut: '',
    date_fin: '',
    motif: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const data = await getCongesByUser(user.id)
      setConges(data)
    } catch { setError('Impossible de charger les congés.') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async () => {
    setError('')
    if (!form.date_debut || !form.date_fin) { setError('Veuillez saisir les dates.'); return }
    if (form.date_fin < form.date_debut) { setError('La date de fin doit être après la date de début.'); return }
    setSaving(true)
    try {
      const newConge = await insertConge({
        user_id: user.id,
        type: form.type,
        date_debut: form.date_debut,
        date_fin: form.date_fin,
        motif: form.motif || null,
        statut: 'en_attente',
      })
      // Notifier tous les managers et admins
      const typeLabel = TYPE_LABELS[form.type]?.label ?? form.type
      const recipients = getUsers().filter(u => u.role === 'admin' || u.role === 'manager')
      await Promise.allSettled(recipients.map(r =>
        insertNotification({
          user_id:  r.id,
          type:     'conge_demande',
          message:  `${user.name} a soumis une demande de ${typeLabel} du ${form.date_debut} au ${form.date_fin}.`,
          lu:       false,
          conge_id: newConge?.id ?? null,
        })
      ))
      setSuccess('Demande envoyée avec succès !')
      setShowForm(false)
      setForm({ type: 'vacances', date_debut: '', date_fin: '', motif: '' })
      await load()
      setTimeout(() => setSuccess(''), 4000)
    } catch { setError('Erreur lors de l\'envoi. Veuillez réessayer.') }
    setSaving(false)
  }

  const handleDelete = async (id, statut) => {
    if (statut !== 'en_attente') { setError('Seules les demandes en attente peuvent être annulées.'); return }
    if (!confirm('Annuler cette demande ?')) return
    try {
      await deleteConge(id)
      await load()
      setSuccess('Demande annulée.')
      setTimeout(() => setSuccess(''), 3000)
    } catch { setError('Erreur lors de l\'annulation.') }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="conge-page">

      <div className="conge-header">
        <div>
          <h2 className="conge-title">Mes demandes de congés</h2>
          <p className="conge-subtitle">Soumettez et suivez vos demandes</p>
        </div>
        <button className="btn-new-conge" onClick={() => { setShowForm(s => !s); setError('') }}>
          {showForm ? '✕ Annuler' : '+ Nouvelle demande'}
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error   && <div className="alert alert-error">{error}</div>}

      {/* FORMULAIRE */}
      {showForm && (
        <div className="conge-form-card">
          <h3 className="form-title">Nouvelle demande</h3>

          <div className="form-group">
            <label>Type de congé</label>
            <div className="type-grid">
              {Object.entries(TYPE_LABELS).map(([key, { label, emoji }]) => (
                <button
                  key={key}
                  className={`type-btn ${form.type === key ? 'active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, type: key }))}
                >
                  <span className="type-emoji">{emoji}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date de début</label>
              <input
                type="date"
                className="form-input"
                min={today}
                value={form.date_debut}
                onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Date de fin</label>
              <input
                type="date"
                className="form-input"
                min={form.date_debut || today}
                value={form.date_fin}
                onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
              />
            </div>
          </div>

          {form.date_debut && form.date_fin && (
            <div className="nb-jours-badge">
              📅 {nbJours(form.date_debut, form.date_fin)} jour{nbJours(form.date_debut, form.date_fin) > 1 ? 's' : ''}
            </div>
          )}

          <div className="form-group">
            <label>Motif <span className="optional">(optionnel)</span></label>
            <textarea
              className="form-textarea"
              placeholder="Précisez si nécessaire..."
              rows={3}
              value={form.motif}
              onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
            />
          </div>

          <button className="btn-submit" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Envoi en cours...' : 'Envoyer la demande'}
          </button>
        </div>
      )}

      {/* LISTE */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : conges.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🌴</div>
          <p>Aucune demande de congé pour l'instant.</p>
          <p className="empty-sub">Cliquez sur "Nouvelle demande" pour commencer.</p>
        </div>
      ) : (
        <div className="conges-list">
          {conges.map(c => {
            const type   = TYPE_LABELS[c.type]   || { label: c.type,   emoji: '📋' }
            const statut = STATUT_CONFIG[c.statut] || { label: c.statut, emoji: '?', cls: '' }
            return (
              <div key={c.id} className={`conge-card ${statut.cls}`}>
                <div className="conge-card-header">
                  <div className="conge-type">
                    <span className="conge-emoji">{type.emoji}</span>
                    <span className="conge-type-label">{type.label}</span>
                  </div>
                  <div className={`statut-badge ${statut.cls}`}>
                    {statut.emoji} {statut.label}
                  </div>
                </div>

                <div className="conge-dates">
                  <span>Du <strong>{formatDate(c.date_debut)}</strong></span>
                  <span className="dates-sep">→</span>
                  <span>au <strong>{formatDate(c.date_fin)}</strong></span>
                  <span className="nb-jours-inline">({c.nb_jours} j)</span>
                </div>

                {c.motif && <p className="conge-motif">💬 {c.motif}</p>}

                {c.commentaire && (
                  <div className="conge-commentaire">
                    <strong>Réponse :</strong> {c.commentaire}
                  </div>
                )}

                {c.statut === 'en_attente' && (
                  <button className="btn-cancel-conge" onClick={() => handleDelete(c.id, c.statut)}>
                    Annuler la demande
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
