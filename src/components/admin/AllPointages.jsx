import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { todayISO, formatDate, formatDateTime, minutesToHHMM } from '../../utils/dateUtils'
import { getAssistants } from '../../lib/localData'
import { getAllPointagesFiltered, deleteTestUserPointages, deletePointageReal } from '../../lib/db'
import { useAuth } from '../../contexts/AuthContext'
import Breadcrumb from '../shared/Breadcrumb'
import './AllPointages.css'

export default function AllPointages() {
  const { isTestMode } = useAuth()
  const [records, setRecords]       = useState([])
  const [inService, setInService]   = useState(0)
  const [loading, setLoading]       = useState(true)
  const [filterUser, setFilterUser] = useState('all')
  const [filterDate, setFilterDate] = useState(todayISO())
  const [deleting,     setDeleting]     = useState(false)
  const [resettingId,  setResettingId]  = useState(null)
  const assistants = getAssistants()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [filtered, all] = await Promise.all([
        getAllPointagesFiltered({
          userId: filterUser !== 'all' ? filterUser : undefined,
          date:   filterDate || undefined,
        }),
        getAllPointagesFiltered({}),
      ])
      setRecords(filtered)
      const t = todayISO()
      setInService(all.filter(r => r.date === t && r.heure_arrivee && !r.heure_depart).length)
    } catch { /* silencieux */ }
    finally { setLoading(false) }
  }, [filterUser, filterDate])

  useEffect(() => { refresh() }, [refresh])

  // Temps réel Supabase
  useEffect(() => {
    const channel = supabase
      .channel('pointages-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pointages' }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [refresh])

  const today = todayISO()
  const presentCount = records.filter(r => r.date === today && r.heure_arrivee && !r.heure_depart).length

  const statusBadge = (r) => {
    if (!r.heure_arrivee) return <span className="badge badge-gray">—</span>
    if (!r.heure_depart)  return <span className="badge badge-green">En service</span>
    return <span className="badge badge-blue">Terminé</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Breadcrumb items={['Cabinet Médical', 'Présences & Pointages']} />
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-number green">{presentCount}</div>
          <div className="stat-label">Présentes aujourd'hui</div>
        </div>
        <div className="stat-card">
          <div className="stat-number blue">{records.length}</div>
          <div className="stat-label">Enregistrements affichés</div>
        </div>
        <div className="stat-card">
          <div className="stat-number orange">{inService}</div>
          <div className="stat-label">En service actuellement</div>
        </div>
      </div>

      <div className="card">
        <div className="filters-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Assistante</label>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="all">Toutes les assistantes</option>
              {assistants.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Date</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}/>
          </div>
          <div className="filters-row-actions">
            <button className="btn btn-outline" onClick={() => setFilterDate('')}>Toutes les dates</button>
            <button className="btn btn-ghost" onClick={refresh}>↻ Actualiser</button>
            {isTestMode && (
              <button
                className="btn btn-danger"
                disabled={deleting}
                onClick={async () => {
                  if (!window.confirm('Supprimer tous les pointages créés par le compte test de Supabase ?')) return
                  setDeleting(true)
                  try { await deleteTestUserPointages(); await refresh() }
                  catch (e) { alert('Erreur : ' + e.message) }
                  finally { setDeleting(false) }
                }}
              >
                {deleting ? 'Suppression…' : '🗑️ Supprimer mes pointages de test'}
              </button>
            )}
          </div>
        </div>

        {loading ? <div className="loading-center"><div className="spinner"/></div>
        : records.length === 0 ? (
          <div className="empty-state-pro">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            <p className="empty-state-pro-title">Aucun pointage trouvé</p>
            <p className="empty-state-pro-sub">Modifiez les filtres ou sélectionnez une autre date.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Assistante</th><th>Date</th><th>Arrivée</th><th>Départ</th><th>Durée</th><th>Statut</th><th>Note</th>
                  {isTestMode && <th>Réinit.</th>}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.users?.name || '—'}</strong></td>
                    <td>{formatDate(r.date)}</td>
                    <td><span style={{ color: 'var(--green-600)', fontWeight: 500 }}>{formatDateTime(r.heure_arrivee)}</span></td>
                    <td>
                      <span style={{ color: r.heure_depart ? 'var(--red-600)' : 'var(--orange-500)', fontWeight: 500 }}>
                        {r.heure_depart ? formatDateTime(r.heure_depart) : (r.heure_arrivee ? 'En cours' : '—')}
                      </span>
                    </td>
                    <td>{r.duree_minutes != null ? <span className="badge badge-blue">{minutesToHHMM(r.duree_minutes)}</span> : '—'}</td>
                    <td>{statusBadge(r)}</td>
                    <td style={{ color: 'var(--gray-500)', fontSize: '0.8125rem' }}>{r.note || '—'}</td>
                    {isTestMode && (
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={resettingId === r.id}
                          title="Réinitialiser ce pointage"
                          onClick={async () => {
                            const name = r.users?.name || 'cette employée'
                            const date = formatDate(r.date)
                            if (!window.confirm(`Réinitialiser le pointage de ${name} du ${date} ?\nL'employée pourra repointer depuis zéro.`)) return
                            setResettingId(r.id)
                            try { await deletePointageReal(r.id); await refresh() }
                            catch (e) { alert('Erreur : ' + e.message) }
                            finally { setResettingId(null) }
                          }}
                        >
                          {resettingId === r.id ? '…' : '🔄'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


    </div>
  )
}
