import { useState } from 'react'
import { formatDate, isoToLocalTime } from '../../utils/dateUtils'
import { updatePointage, deletePointage } from '../../lib/db'

export default function EditPointageModal({ pointage, onClose, onSaved }) {
  const [arrivee, setArrivee] = useState(isoToLocalTime(pointage.heure_arrivee))
  const [depart,  setDepart]  = useState(isoToLocalTime(pointage.heure_depart))
  const [note,    setNote]    = useState(pointage.note || '')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const buildIso = (date, timeStr) => timeStr ? `${date}T${timeStr}:00` : null

  const handleSave = async () => {
    if (!arrivee) { setError("L'heure d'arrivée est requise"); return }
    if (depart && depart < arrivee) { setError('Le départ doit être après l\'arrivée'); return }
    setLoading(true); setError('')
    try {
      await updatePointage(pointage.id, {
        heure_arrivee: buildIso(pointage.date, arrivee),
        heure_depart:  buildIso(pointage.date, depart),
        note: note.trim() || null,
      })
      onSaved()
    } catch (e) {
      setError('Erreur lors de la sauvegarde : ' + e.message)
    } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!confirm('Supprimer ce pointage ?')) return
    setLoading(true)
    try { await deletePointage(pointage.id); onSaved() }
    catch (e) { setError('Erreur : ' + e.message); setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Modifier le pointage</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '0.25rem' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--gray-50)', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
            <strong>Date :</strong> {formatDate(pointage.date)}
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label>Heure d'arrivée *</label>
            <input type="time" value={arrivee} onChange={e => setArrivee(e.target.value)}/>
          </div>
          <div className="form-group">
            <label>Heure de départ</label>
            <input type="time" value={depart} onChange={e => setDepart(e.target.value)}/>
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Laisser vide si encore en service</span>
          </div>
          <div className="form-group">
            <label>Note (optionnel)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Remarque..." style={{ resize: 'vertical' }}/>
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>Supprimer</button>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-outline" onClick={onClose} disabled={loading}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
