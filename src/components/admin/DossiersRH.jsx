import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getUsers } from '../../lib/localData'
import {
  getDocumentsByUser, insertDocument, deleteDocument,
  uploadToStorage, getStorageUrl, deleteFromStorage,
  createSignedDownloadUrl,
} from '../../lib/db'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Breadcrumb from '../shared/Breadcrumb'
import './DossiersRH.css'

const DOSSIERS = [
  { code: '10', label: 'Doc Perso',            icon: '👤' },
  { code: '20', label: 'Contrats',             icon: '📋' },
  { code: '30', label: 'Courrier',             icon: '✉️' },
  { code: '40', label: 'Fiches de salaires',   icon: '💰' },
  { code: '50', label: 'Certificats médicaux', icon: '🏥' },
  { code: '60', label: 'Evaluations',          icon: '⭐' },
  { code: '70', label: 'Autres',               icon: '📁' },
]

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx'
const MAX_MB  = 10

const fileIcon = (name) => {
  const ext = name?.split('.').pop()?.toLowerCase()
  if (['pdf'].includes(ext))             return '📄'
  if (['jpg','jpeg','png','gif'].includes(ext)) return '🖼️'
  if (['doc','docx'].includes(ext))      return '📝'
  if (['xls','xlsx'].includes(ext))      return '📊'
  return '📎'
}

export default function DossiersRH() {
  const { user } = useAuth()

  // Employées visibles dans les dossiers (excl. admins et test)
  const employees = getUsers().filter(u =>
    !u._isTestUser && u.name !== 'Test Admin' && u.id !== user.id
  )

  const [view,     setView]     = useState('employees') // 'employees' | 'dossiers' | 'files'
  const [selEmp,   setSelEmp]   = useState(null)
  const [selDoss,  setSelDoss]  = useState(null)
  const [docs,     setDocs]     = useState([])
  const [loading,  setLoading]  = useState(false)
  const [uploading,setUploading]= useState(false)
  const [uploadErr,setUploadErr]= useState('')
  const fileRef = useRef()

  const loadDocs = async (empId) => {
    setLoading(true)
    try { setDocs(await getDocumentsByUser(empId)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (selEmp) loadDocs(selEmp.id) }, [selEmp?.id])

  const openEmployee = (emp) => { setSelEmp(emp); setView('dossiers') }
  const openDossier  = (code) => { setSelDoss(code); setView('files'); setUploadErr('') }
  const backToList   = () => { setView('employees'); setSelEmp(null); setSelDoss(null) }
  const backToDoss   = () => { setView('dossiers'); setSelDoss(null); setUploadErr('') }

  const dossierCount = (code) => docs.filter(d => d.dossier === code).length
  const dossierFiles = (code) => docs.filter(d => d.dossier === code)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadErr(`Fichier trop volumineux (max ${MAX_MB} Mo).`)
      e.target.value = ''
      return
    }
    setUploading(true); setUploadErr('')
    try {
      const safeName  = file.name.replace(/[^a-zA-Z0-9._\-éèêëàâùûüçîïôœæ ]/g, '_')
      const path      = `${selEmp.id}/${selDoss}/${Date.now()}-${safeName}`
      await uploadToStorage(file, path)
      const url = getStorageUrl(path)
      const doc = await insertDocument({
        user_id:      selEmp.id,
        dossier:      selDoss,
        nom_fichier:  file.name,
        url,
        storage_path: path,
        uploaded_by:  user.id,
      })
      setDocs(prev => [doc, ...prev])
    } catch (err) {
      setUploadErr(err.message || "Erreur lors de l'upload.")
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (doc) => {
    if (!window.confirm(`Supprimer "${doc.nom_fichier}" définitivement ?`)) return
    try {
      if (doc.storage_path) await deleteFromStorage(doc.storage_path)
      await deleteDocument(doc.id)
      setDocs(prev => prev.filter(d => d.id !== doc.id))
    } catch (err) {
      alert('Erreur lors de la suppression : ' + err.message)
    }
  }

  // ── Vue : liste des employées ──────────────────────────────
  if (view === 'employees') return (
    <div className="drh-wrap">
      <Breadcrumb items={['Cabinet Médical', 'Dossiers RH']} />
      <div className="card drh-header-card">
        <h2 className="section-title">Dossiers RH</h2>
        <p className="drh-subtitle">Sélectionnez une employée pour accéder à son dossier.</p>
      </div>
      <div className="drh-emp-grid">
        {employees.map(emp => (
          <button key={emp.id} className="drh-emp-card" onClick={() => openEmployee(emp)}>
            <div className="drh-emp-avatar" style={{ background: emp.color }}>{emp.name[0]}</div>
            <div className="drh-emp-info">
              <span className="drh-emp-name">{emp.name}</span>
              <span className="drh-emp-poste">{emp.poste || emp.role}</span>
            </div>
            <svg className="drh-emp-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        ))}
      </div>
    </div>
  )

  // ── Vue : dossiers de l'employée ──────────────────────────
  if (view === 'dossiers') return (
    <div className="drh-wrap">
      <Breadcrumb items={['Cabinet Médical', 'Dossiers RH', selEmp?.name]} />
      <div className="card drh-header-card">
        <button className="drh-back-btn" onClick={backToList}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          Retour
        </button>
        <div className="drh-emp-hero">
          <div className="drh-emp-avatar drh-emp-avatar-lg" style={{ background: selEmp?.color }}>{selEmp?.name[0]}</div>
          <div>
            <h2 className="drh-emp-name-lg">{selEmp?.name}</h2>
            <p className="drh-emp-poste-lg">{selEmp?.poste}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="drh-doss-grid">
          {DOSSIERS.map(d => {
            const count = dossierCount(d.code)
            return (
              <button key={d.code} className="drh-doss-card" onClick={() => openDossier(d.code)}>
                <span className="drh-doss-icon">{d.icon}</span>
                <div className="drh-doss-info">
                  <span className="drh-doss-code">{d.code}</span>
                  <span className="drh-doss-label">{d.label}</span>
                </div>
                <span className={`drh-doss-count${count > 0 ? ' has-files' : ''}`}>
                  {count} fichier{count !== 1 ? 's' : ''}
                </span>
                <svg className="drh-emp-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── Vue : fichiers du dossier ──────────────────────────────
  const dossierMeta = DOSSIERS.find(d => d.code === selDoss)
  const files       = dossierFiles(selDoss)

  return (
    <div className="drh-wrap">
      <Breadcrumb items={['Cabinet Médical', 'Dossiers RH', selEmp?.name, `${selDoss} – ${dossierMeta?.label}`]} />

      <div className="card drh-header-card">
        <button className="drh-back-btn" onClick={backToDoss}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          Retour
        </button>
        <div className="drh-folder-hero">
          <span className="drh-doss-icon-lg">{dossierMeta?.icon}</span>
          <div>
            <h2 className="drh-folder-title">{selDoss} – {dossierMeta?.label}</h2>
            <p className="drh-folder-sub">{selEmp?.name}</p>
          </div>
        </div>
        <div className="drh-upload-zone">
          {uploadErr && <div className="error-msg drh-upload-err">{uploadErr}</div>}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            style={{ display: 'none' }}
            onChange={handleUpload}
            disabled={uploading}
          />
          <button
            className="btn btn-primary drh-upload-btn"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <><div className="spinner drh-spinner" /> Envoi en cours…</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Ajouter un fichier
              </>
            )}
          </button>
          <p className="drh-upload-hint">PDF, images, Word, Excel — max {MAX_MB} Mo</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : files.length === 0 ? (
        <div className="card drh-empty">
          <span style={{ fontSize: '2.5rem' }}>📂</span>
          <p>Aucun fichier dans ce dossier.</p>
          <p className="drh-empty-hint">Cliquez sur "Ajouter un fichier" pour uploader le premier document.</p>
        </div>
      ) : (
        <div className="card drh-files-card">
          <div className="drh-files-list">
            {files.map(doc => (
              <div key={doc.id} className="drh-file-row">
                <span className="drh-file-icon">{fileIcon(doc.nom_fichier)}</span>
                <div className="drh-file-info">
                  <span className="drh-file-name">{doc.nom_fichier}</span>
                  <span className="drh-file-date">
                    {format(new Date(doc.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  </span>
                </div>
                <div className="drh-file-actions">
                  <button
                    className="btn btn-outline btn-sm drh-btn-dl"
                    onClick={async () => {
                      try {
                        const url = await createSignedDownloadUrl(doc.storage_path || doc.url)
                        window.open(url, '_blank', 'noopener,noreferrer')
                      } catch (e) {
                        alert('Erreur téléchargement : ' + e.message)
                      }
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Télécharger
                  </button>
                  <button
                    className="btn btn-danger btn-sm drh-btn-del"
                    onClick={() => handleDelete(doc)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                      <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
