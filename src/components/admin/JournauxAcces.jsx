import { useState, useEffect } from 'react'
import { getAccessLogs } from '../../lib/db'
import { getUserById } from '../../lib/localData'
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

export default function JournauxAcces() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try { setLogs(await getAccessLogs(50)) }
      catch { setError('Impossible de charger les journaux.') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const successes = logs.filter(l => l.action === 'login_success').length
  const failures  = logs.filter(l => l.action === 'login_failure').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Breadcrumb items={["Cabinet Médical", "Admin", "Journaux d'accès"]} />

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
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--gray-100)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)' }}>
            Journaux d'accès
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
            50 derniers événements de connexion
          </p>
        </div>

        {error && <div className="error-msg" style={{ margin: '1rem' }}>{error}</div>}

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : logs.length === 0 ? (
          <div className="empty-state-pro" style={{ padding: '2.5rem' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <p className="empty-state-pro-title">Aucun journal</p>
            <p className="empty-state-pro-sub">Les connexions apparaîtront ici après la première utilisation.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date / Heure</th>
                  <th>Utilisateur</th>
                  <th>Statut</th>
                  <th>Navigateur</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => {
                  const u         = getUserById(l.user_id)
                  const isSuccess = l.action === 'login_success'
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
                        <span className={`badge ${isSuccess ? 'badge-green' : 'badge-red'}`}>
                          {isSuccess ? '✓ Connexion réussie' : '✗ Échec'}
                        </span>
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
