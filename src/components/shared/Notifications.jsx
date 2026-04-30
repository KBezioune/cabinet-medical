import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../lib/db'
import './Notifications.css'

const TYPE_ICON = {
  conge_demande:  '📋',
  conge_approuve: '✅',
  conge_refuse:   '❌',
  conge_modifie:  '✏️',
}

function formatTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000)   return 'À l\'instant'
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)}h`
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function Notifications() {
  const { user }    = useAuth()
  const [notifs, setNotifs] = useState([])
  const [open, setOpen]     = useState(false)
  const wrapRef = useRef(null)

  const load = useCallback(async () => {
    try { setNotifs(await getNotificationsForUser(user.id)) } catch {}
  }, [user.id])

  // Chargement initial + polling 30 s
  useEffect(() => {
    load()
    const timer = setInterval(load, 30_000)
    return () => clearInterval(timer)
  }, [load])

  // Ferme le dropdown au clic extérieur
  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const unread = notifs.filter(n => !n.lu).length

  const handleItem = async (n) => {
    if (n.lu) return
    try {
      await markNotificationRead(n.id)
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, lu: true } : x))
    } catch {}
  }

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead(user.id)
      setNotifs(prev => prev.map(x => ({ ...x, lu: true })))
    } catch {}
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className={`notif-bell${open ? ' notif-bell-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unread > 0 ? ` — ${unread} non lue${unread > 1 ? 's' : ''}` : ''}`}
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="menu">
          <div className="notif-head">
            <span className="notif-head-title">Notifications</span>
            {unread > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAll}>
                Tout marquer lu
              </button>
            )}
          </div>

          {notifs.length === 0 ? (
            <div className="notif-empty">Aucune notification</div>
          ) : (
            <div className="notif-list">
              {notifs.map(n => (
                <div
                  key={n.id}
                  className={`notif-item${n.lu ? ' notif-lu' : ' notif-nonlu'}`}
                  onClick={() => handleItem(n)}
                  role="menuitem"
                >
                  <span className="notif-icon">{TYPE_ICON[n.type] ?? '📬'}</span>
                  <div className="notif-content">
                    <p className="notif-msg">{n.message}</p>
                    <span className="notif-time">{formatTime(n.created_at)}</span>
                  </div>
                  {!n.lu && <span className="notif-dot" aria-hidden="true" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
