import { useState } from 'react'
import { getUsers, updateUserPin } from '../../lib/localData'
import { updateUserPinInDb } from '../../lib/db'
import Breadcrumb from '../shared/Breadcrumb'
import './GestionPins.css'

const getNonAdmins = () => getUsers().filter(u => u.role !== 'admin')

const validate = (pwd, userId) => {
  if (pwd.trim().length < 6)
    return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (!/^[a-zA-Z0-9]+$/.test(pwd.trim()))
    return 'Uniquement des lettres et des chiffres (sans espace ni caractère spécial).'
  const taken = getUsers().find(u => u.id !== userId && u.pin === pwd.trim())
  if (taken)
    return `Ce mot de passe est déjà utilisé par ${taken.name}.`
  return null
}

export default function GestionPins() {
  const [staff,    setStaff]    = useState(getNonAdmins)
  const [editing,  setEditing]  = useState(null)
  const [newPwd,   setNewPwd]   = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [revealed, setRevealed] = useState({})
  const [msg,      setMsg]      = useState(null)
  const [saving,   setSaving]   = useState(false)

  const startEdit  = (u) => { setEditing(u.id); setNewPwd(''); setShowPwd(false); setMsg(null) }
  const cancelEdit = () => { setEditing(null); setNewPwd('') }

  const savePwd = async (userId) => {
    const err = validate(newPwd, userId)
    if (err) { setMsg({ type: 'error', text: err }); return }

    setSaving(true)
    setMsg(null)
    try {
      await updateUserPinInDb(userId, newPwd.trim())
      updateUserPin(userId, newPwd.trim())
      setStaff(getNonAdmins())
      setEditing(null)
      setNewPwd('')
      setMsg({ type: 'success', text: '✅ Mot de passe mis à jour sur tous les appareils.' })
      setTimeout(() => setMsg(null), 4000)
    } catch (e) {
      setMsg({ type: 'error', text: `Erreur Supabase : ${e?.message || 'connexion impossible'}` })
    } finally {
      setSaving(false)
    }
  }

  const toggleReveal = (id) => setRevealed(r => ({ ...r, [id]: !r[id] }))

  const EyeOpen = () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )
  const EyeOff = () => (
    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Breadcrumb items={['Cabinet Médical', 'Admin', 'Mots de passe']} />
      {msg && <div className={msg.type === 'error' ? 'error-msg' : 'success-msg'}>{msg.text}</div>}

      <div className="card">
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gray-800)' }}>
            Gestion des mots de passe
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
            Mots de passe alphanumériques (min. 6 caractères). Synchronisés via Supabase sur tous les appareils.
          </p>
        </div>

        <div className="pins-list">
          {staff.map(u => (
            <div key={u.id} className="pin-row">
              <div className="pin-row-avatar">{u.name[0]}</div>

              <div className="pin-row-info">
                <div className="pin-row-name">{u.name}</div>
                <div className="pin-row-role">{u.role === 'manager' ? 'Manager' : 'Assistante médicale'}</div>
              </div>

              {editing === u.id ? (
                <div className="pin-edit-zone">
                  <div className="pwd-input-wrap">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      placeholder="Nouveau mot de passe"
                      className="pin-edit-input"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter')  savePwd(u.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                    />
                    <button
                      type="button"
                      className="pin-reveal-btn"
                      onClick={() => setShowPwd(v => !v)}
                      tabIndex={-1}
                      title={showPwd ? 'Masquer' : 'Afficher'}
                    >
                      {showPwd ? <EyeOff /> : <EyeOpen />}
                    </button>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => savePwd(u.id)}
                    disabled={newPwd.trim().length < 6 || saving}
                  >
                    {saving ? '…' : '✓ Valider'}
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
                      : <span className="pin-dots">{'●'.repeat(Math.min(u.pin.length, 10))}</span>
                    }
                    <button className="pin-reveal-btn" onClick={() => toggleReveal(u.id)} title={revealed[u.id] ? 'Masquer' : 'Afficher'}>
                      {revealed[u.id] ? <EyeOff /> : <EyeOpen />}
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
          Les mots de passe sont synchronisés via Supabase. Les changements s'appliquent immédiatement sur tous les appareils.
        </div>
      </div>
    </div>
  )
}
