import { useState, useEffect, useMemo } from 'react'
import { getAccessLogs } from '../../lib/db'
import { getUserById, getUsers } from '../../lib/localData'
import Breadcrumb from '../shared/Breadcrumb'

const formatDT = (iso) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

const shortUA = (ua) => {
  if (!ua) return '—'
  if (/mobile/i.test(ua))  return 'Mobile'
  if (/firefox/i.test(ua)) return 'Firefox'
  if (/edg/i.test(ua))     return 'Edge'
  if (/chrome/i.test(ua))  return 'Chrome'
  if (/safari/i.test(ua))  return 'Safari'
  return ua.slice(0, 30)
}

// Type d'événement normalisé — supporte les anciens logs (action seule, sans type_evenement)
const resolveType = (l) => l.type_evenement || (
  l.action === 'login_success' ? 'connexion_reussie' :
  l.action === 'login_failure' ? 'connexion_echec'   :
  l.action || 'autre'
)

const TYPE_CONFIG = {
  connexion_reussie: { label: 'Connexion réussie', emoji: '✓', badge: 'badge-green'  },
  connexion_echec:   { label: 'Échec de connexion', emoji: '✗', badge: 'badge-red'    },
  pointage_arrivee:  { label: 'Pointage arrivée',   emoji: '🕐', badge: 'badge-blue'   },
  pointage_depart:   { label: 'Pointage départ',    emoji: '🕐', badge: 'badge-blue'   },
  conge_soumis:      { label: 'Demande de congé',   emoji: '📋', badge: 'badge-orange' },
  autre:             { label: 'Autre',              emoji: '•', badge: 'badge-gray'   },
}

export default function JournauxAcces() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterUser, setFilterUser] = useState('all')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try { setLogs(await getAccessLogs(300)) }
      catch { setError('Impossible de charger les journaux.') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const employees = useMemo(() => getUsers(), [])

  const filteredLogs = useMemo(() => logs.filter(l => {
    if (filterType !== 'all' && resolveType(l) !== filterType) return false
    if (filterUser !== 'all' && l.user_id !== filterUser) return false
    return true
  }), [logs, filterType, filterUser])

  const successes = logs.filter(l => resolveType(l) === 'connexion_reussie').length
  const failures  = logs.filter(l => resolveType(l) === 'connexion_echec').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Breadcrumb items={["Centre Médical Dorigny", "Admin", "Journaux d'accès"]} />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gray-800)' }}>{logs.length}</div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>Événements</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--green-600)' }}>{successes}</div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>Connexions réussies</div>
        </div>
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: failures > 0 ? 'var(--red-600)' : 'var(--gray-400)' }}>{failures}</div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>Échecs de connexion</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)' }}>
              Journaux d'accès
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
              {filteredLogs.length} événement{filteredLogs.length > 1 ? 's' : ''} {filterType !== 'all' || filterUser !== 'all' ? '(filtré)' : `(300 derniers)`}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ fontSize: '0.8125rem', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid var(--gray-200)', background: 'white', color: 'var(--gray-700)' }}
            >
              <option value="all">Tous les types</option>
              {Object.entries(TYPE_CONFIG).filter(([k]) => k !== 'autre').map(([k, cfg]) => (
                <option key={k} value={k}>{cfg.label}</option>
              ))}
            </select>

            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              style={{ fontSize: '0.8125rem', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid var(--gray-200)', background: 'white', color: 'var(--gray-700)' }}
            >
              <option value="all">Toutes les employées</option>
              {employees.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="error-msg" style={{ margin: '1rem' }}>{error}</div>}

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state-pro" style={{ padding: '2.5rem' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <p className="empty-state-pro-title">Aucun journal</p>
            <p className="empty-state-pro-sub">
              {logs.length === 0
                ? "Les événements apparaîtront ici après la première utilisation."
                : "Aucun événement ne correspond à ces filtres."}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date / Heure</th>
                  <th>Employée</th>
                  <th>Type d'événement</th>
                  <th>Détail</th>
                  <th>Navigateur</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(l => {
                  const u    = getUserById(l.user_id)
                  const type = TYPE_CONFIG[resolveType(l)] || TYPE_CONFIG.autre
                  return (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--gray-600)', fontVariantNumeric: 'tabular-nums' }}>
                        {formatDT(l.created_at)}
                      </td>
                      <td>
                        {u ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '1.5rem', height: '1.5rem', borderRadius: '50%', flexShrink: 0,
                              background: 'linear-gradient(135deg, var(--brand-500), var(--teal-500))',
                              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.6875rem', fontWeight: 800,
                            }}>
                              {u.name[0]}
                            </div>
                            <span style={{ fontWeight: 600 }}>{u.name}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>Inconnu</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${type.badge}`}>
                          {type.emoji} {type.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--gray-500)', fontSize: '0.8125rem' }}>
                        {l.detail || '—'}
                      </td>
                      <td style={{ color: 'var(--gray-500)', fontSize: '0.8125rem' }}>
                        {shortUA(l.user_agent)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
