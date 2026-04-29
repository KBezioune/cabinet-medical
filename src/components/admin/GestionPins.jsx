import { useState } from 'react'
import { getUsers, updateUserPin } from '../../lib/localData'
import { updateUserPinInDb } from '../../lib/db'
import './GestionPins.css'

const getAssistantsOnly = () => getUsers().filter(u => u.role === 'assistant')

export default function GestionPins() {
  const [assistants, setAssistants] = useState(getAssistantsOnly)
  const [editing, setEditing]       = useState(null)
  const [newPin, setNewPin]         = useState('')
  const [revealed, setRevealed]     = useState({})
  const [msg, setMsg]               = useState(null)
  const [saving, setSaving]         = useState(false)

  const startEdit  = (u) => { setEditing(u.id); setNewPin(''); setMsg(null) }
  const cancelEdit = () => { setEditing(null); setNewPin('') }

  const savePin = async (userId) => {
    if (!/^\d{4}$/.test(newPin)) {
      setMsg({ type: 'error', text: 'Le PIN doit contenir exactement 4 chiffres.' })
      return
    }
    const taken = getUsers().find(u => u.id !== userId && u.pin === newPin)
    if (taken) {
      setMsg({ type: 'error', text: `Ce PIN est déjà utilisé par ${taken.name}.` })
      return
    }

    setSaving(true)
    setMsg(null)
    try {
      await updateUserPinInDb(userId, newPin)
      updateUserPin(userId, newPin)
      setAssistants(getAssistantsOnly())
      setEditing(null)
      setNewPin('')
      setMsg({ type: 'success', text: '✅ PIN mis à jour sur tous les appareils.' })
      setTimeout(() => setMsg(null), 4000)
    } catch (e) {
      setMsg({ type: 'error', text: `Erreur Supabase : ${e?.message || 'connexion impossible'}` })
    } finally {
      setSaving(false)
    }
  }

  const toggleReveal = (id) => setRevealed(r => ({ ...r, [id]: !r[id] }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {msg && <div className={msg.type === 'error' ? 'error-msg' : 'success-msg'}>{msg.text}</div>}

      <div className="card">
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gray-800)' }}>
            Gestion des codes PIN
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
            Les modifications sont sauvegardées dans Supabase et s'appliquent sur tous les appareils.
          </p>
        </div>

        <div className="pins-list">
          {assistants.map(u => (
            <div key={u.id} className="pin-row">
              <div className="pin-row-avatar">{u.name[0]}</div>

              <div className="pin-row-info">
                <div className="pin-row-name">{u.name}</div>
                <div className="pin-row-role">Assistante médicale</div>
              </div>

              {editing === u.id ? (
                <div className="pin-edit-zone">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Nouveau PIN"
                    className="pin-edit-input"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') savePin(u.id)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => savePin(u.id)}
                    disabled={newPin.length !== 4 || saving}
                  >
                    {saving ? '...' : '✓ Valider'}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={cancelEdit} disabled={saving}>
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="pin-current-zone">
                  <div className="pin-value">
                    {revealed[u.id]
                      ? <span className="pin-digits">{u.pin}</span>
                      : <span className="pin-dots">{'●'.repeat(4)}</span>
                    }
                    <button className="pin-reveal-btn" onClick={() => toggleReveal(u.id)} title={revealed[u.id] ? 'Masquer' : 'Afficher'}>
                      {revealed[u.id]
                        ? <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => startEdit(u)}>
                    ✏️ Modifier
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="pins-note">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Les PINs sont synchronisés via Supabase. Au démarrage de l'app sur n'importe quel appareil, les PINs sont automatiquement mis à jour.
        </div>
      </div>
    </div>
  )
}
