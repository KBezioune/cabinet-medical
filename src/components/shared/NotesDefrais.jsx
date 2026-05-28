import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getUserById } from '../../lib/localData'
import {
  getExpenseReports, getExpenseReportsByUser,
  insertExpenseReport, updateExpenseReportStatut, deleteExpenseReport,
} from '../../lib/db'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { todayISO } from '../../utils/dateUtils'
import Breadcrumb from './Breadcrumb'
import './NotesDefrais.css'

const CATS = {
  repas:      { label: 'Repas',      icon: '🍽️' },
  transport:  { label: 'Transport',  icon: '🚌' },
  materiel:   { label: 'Matériel',   icon: '📦' },
  autre:      { label: 'Autre',      icon: '📎' },
}

const STATUTS = {
  en_attente: { label: 'En attente', cls: 'wait' },
  approuve:   { label: 'Approuvé',   cls: 'ok'   },
  refuse:     { label: 'Refusé',     cls: 'ko'   },
}

const TABLE_MISSING = "relation \"public.expense_reports\" does not exist"

export default function NotesDefrais() {
  const { user } = useAuth()
  const isAdmin  = user.role === 'admin' || user.role === 'manager'

  const [reports,  setReports]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [noTable,  setNoTable]  = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [modal,    setModal]    = useState(null) // { report } — pour validation admin
  const [filter,   setFilter]   = useState('tous')

  // Formulaire
  const [fDate,    setFDate]    = useState(todayISO())
  const [fMontant, setFMontant] = useState('')
  const [fCat,     setFCat]     = useState('repas')
  const [fDesc,    setFDesc]    = useState('')
  const [fFile,    setFFile]    = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [formErr,  setFormErr]  = useState('')

  // Modal admin
  const [mComment, setMComment] = useState('')
  const [mSaving,  setMSaving]  = useState(false)

  const fileRef = useRef()

  const load = async () => {
    setLoading(true)
    try {
      const data = isAdmin
        ? await getExpenseReports()
        : await getExpenseReportsByUser(user.id)
      setReports(data)
    } catch (e) {
      if (e?.message?.includes('does not exist') || e?.code === '42P01') setNoTable(true)
      else console.error(e)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async e => {
    e.preventDefault()
    if (!fMontant || isNaN(Number(fMontant)) || Number(fMontant) <= 0) {
      setFormErr('Montant invalide'); return
    }
    setSaving(true); setFormErr('')
    try {
      await insertExpenseReport({
        user_id:     user.id,
        date:        fDate,
        montant:     Number(fMontant),
        categorie:   fCat,
        description: fDesc || null,
      })
      setShowForm(false)
      setFDate(todayISO()); setFMontant(''); setFCat('repas'); setFDesc(''); setFFile(null)
      await load()
    } catch (e) { setFormErr(e.message || 'Erreur lors de la soumission') }
    finally { setSaving(false) }
  }

  const handleDecision = async (statut) => {
    setMSaving(true)
    try {
      await updateExpenseReportStatut(modal.id, statut, user.id, mComment)
      setModal(null); setMComment(''); await load()
    } catch (e) { console.error(e) }
    finally { setMSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette note de frais ?')) return
    try { await deleteExpenseReport(id); await load() }
    catch (e) { console.error(e) }
  }

  const filtered = filter === 'tous' ? reports : reports.filter(r => r.statut === filter)

  const totalPending  = reports.filter(r => r.statut === 'en_attente').length
  const totalApproved = reports.reduce((s, r) => r.statut === 'approuve' ? s + Number(r.montant) : s, 0)

  if (noTable) {
    return (
      <div className="ndf-wrap">
        <Breadcrumb items={['Cabinet Médical', 'Notes de frais']} />
        <div className="card ndf-setup">
          <div className="ndf-setup-icon">🗄️</div>
          <h2>Table Supabase manquante</h2>
          <p>Créez la table <code>expense_reports</code> dans Supabase avec ce SQL :</p>
          <pre className="ndf-sql">{`CREATE TABLE expense_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  montant NUMERIC(10,2) NOT NULL,
  categorie TEXT NOT NULL,
  description TEXT,
  justificatif_url TEXT,
  statut TEXT DEFAULT 'en_attente',
  traite_par TEXT,
  traite_le TIMESTAMPTZ,
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="ndf-wrap">
      <Breadcrumb items={['Cabinet Médical', 'Notes de frais']} />

      {/* KPIs */}
      <div className="ndf-kpis">
        <div className="ndf-kpi">
          <span className="ndf-kpi-val">{reports.length}</span>
          <span className="ndf-kpi-lbl">Total notes</span>
        </div>
        {isAdmin && (
          <div className="ndf-kpi ndf-kpi-warn">
            <span className="ndf-kpi-val">{totalPending}</span>
            <span className="ndf-kpi-lbl">En attente</span>
          </div>
        )}
        <div className="ndf-kpi ndf-kpi-ok">
          <span className="ndf-kpi-val">CHF {totalApproved.toFixed(2)}</span>
          <span className="ndf-kpi-lbl">Approuvé</span>
        </div>
        {!isAdmin && (
          <div className="ndf-kpi ndf-kpi-action">
            <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
              {showForm ? '✕ Annuler' : '+ Nouvelle note'}
            </button>
          </div>
        )}
      </div>

      {/* Formulaire soumission (employée) */}
      {!isAdmin && showForm && (
        <div className="card ndf-form-card">
          <h3 className="ndf-form-title">Soumettre une note de frais</h3>
          <form onSubmit={handleSubmit} className="ndf-form">
            {formErr && <div className="error-msg">{formErr}</div>}

            <div className="ndf-form-row">
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Montant (CHF)</label>
                <input
                  type="number" step="0.05" min="0.05" placeholder="0.00"
                  value={fMontant} onChange={e => setFMontant(e.target.value)} required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Catégorie</label>
              <div className="ndf-cat-grid">
                {Object.entries(CATS).map(([k, v]) => (
                  <button
                    key={k} type="button"
                    className={`ndf-cat-btn${fCat === k ? ' active' : ''}`}
                    onClick={() => setFCat(k)}
                  >
                    <span>{v.icon}</span>
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                rows={2} placeholder="Détails de la dépense…"
                value={fDesc} onChange={e => setFDesc(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Justificatif (photo)</label>
              <input
                type="file" accept="image/*" ref={fileRef}
                onChange={e => setFFile(e.target.files[0])}
                className="ndf-file"
              />
              <p className="ndf-file-note">📸 La photo est sauvegardée localement — upload Supabase Storage optionnel.</p>
            </div>

            <div className="ndf-form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Envoi…' : 'Soumettre'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtres */}
      <div className="card ndf-list-card">
        <div className="ndf-list-head">
          <h3 className="ndf-list-title">
            {isAdmin ? 'Toutes les notes de frais' : 'Mes notes de frais'}
          </h3>
          <div className="ndf-filters">
            {['tous','en_attente','approuve','refuse'].map(f => (
              <button
                key={f}
                className={`ndf-filter-btn${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'tous' ? 'Toutes' : STATUTS[f]?.label}
                {f === 'en_attente' && totalPending > 0 && (
                  <span className="ndf-badge">{totalPending}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <p className="ndf-empty">Aucune note de frais{filter !== 'tous' ? ' dans ce statut' : ''}.</p>
        ) : (
          <div className="ndf-list">
            {filtered.map(r => {
              const emp = getUserById(r.user_id)
              const cat = CATS[r.categorie] || CATS.autre
              const st  = STATUTS[r.statut] || STATUTS.en_attente
              return (
                <div key={r.id} className={`ndf-item ndf-item-${st.cls}`}>
                  <div className="ndf-item-left">
                    <span className="ndf-item-icon">{cat.icon}</span>
                    <div className="ndf-item-info">
                      {isAdmin && emp && (
                        <span className="ndf-item-emp">{emp.name}</span>
                      )}
                      <span className="ndf-item-cat">{cat.label}</span>
                      <span className="ndf-item-date">
                        {format(new Date(r.date + 'T12:00:00'), 'dd MMMM yyyy', { locale: fr })}
                      </span>
                      {r.description && <span className="ndf-item-desc">{r.description}</span>}
                    </div>
                  </div>
                  <div className="ndf-item-right">
                    <span className="ndf-item-montant">CHF {Number(r.montant).toFixed(2)}</span>
                    <span className={`ndf-statut ndf-st-${st.cls}`}>{st.label}</span>
                    <div className="ndf-item-actions">
                      {isAdmin && r.statut === 'en_attente' && (
                        <button className="btn btn-sm btn-primary" onClick={() => { setModal(r); setMComment('') }}>
                          Traiter
                        </button>
                      )}
                      {!isAdmin && r.statut === 'en_attente' && (
                        <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(r.id)}>
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal validation admin */}
      {modal && (
        <div className="modal-overlay" onClick={() => !mSaving && setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Traiter la note de frais</h2>
                <p className="pt-modal-sub">
                  {getUserById(modal.user_id)?.name} — {CATS[modal.categorie]?.label} — CHF {Number(modal.montant).toFixed(2)}
                </p>
              </div>
              <button className="btn btn-ghost" onClick={() => setModal(null)} disabled={mSaving}>✕</button>
            </div>
            <div className="modal-body">
              <div className="ndf-modal-detail">
                <span><strong>Date :</strong> {format(new Date(modal.date + 'T12:00:00'), 'dd MMMM yyyy', { locale: fr })}</span>
                {modal.description && <span><strong>Détail :</strong> {modal.description}</span>}
              </div>
              <div className="form-group">
                <label>Commentaire (optionnel)</label>
                <textarea
                  rows={2} placeholder="Motif de refus, remarque…"
                  value={mComment} onChange={e => setMComment(e.target.value)}
                  disabled={mSaving}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)} disabled={mSaving}>Annuler</button>
              <button className="btn btn-danger" onClick={() => handleDecision('refuse')} disabled={mSaving}>
                {mSaving ? '…' : 'Refuser'}
              </button>
              <button className="btn btn-primary" onClick={() => handleDecision('approuve')} disabled={mSaving}>
                {mSaving ? '…' : 'Approuver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
