import { useState, useEffect } from 'react'
import { testConnection } from '../lib/db'

export default function DbStatus() {
  const [status, setStatus] = useState(null) // null=loading, true=ok, string=erreur

  useEffect(() => {
    testConnection().then(res => {
      setStatus(res.ok ? true : res.message)
    })
  }, [])

  if (status === null || status === true) return null

  return (
    <div style={{
      position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
      background: '#1e293b', color: '#f8fafc', borderRadius: '0.75rem',
      padding: '0.875rem 1.25rem', fontSize: '0.8125rem', zIndex: 9999,
      boxShadow: '0 8px 24px rgb(0 0 0 / 0.4)', maxWidth: '90vw',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      border: '1px solid #ef4444',
    }}>
      <span style={{ fontSize: '1.125rem' }}>⚠️</span>
      <div>
        <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: '0.2rem' }}>Supabase inaccessible</div>
        <div style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.75rem' }}>{status}</div>
        <div style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.75rem' }}>
          URL: {import.meta.env.VITE_SUPABASE_URL || '(manquante)'}
        </div>
      </div>
    </div>
  )
}
