import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getUsers, getUserById } from '../../lib/localData'
import { getMessages, sendMessage, markMessageRead } from '../../lib/db'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Breadcrumb from './Breadcrumb'
import './Messages.css'

const ADMIN_ID = '00000000-0000-0000-0000-000000000004'
const TABLE_ERR = 'messages'

function isMissingTable(err) {
  return err?.message?.toLowerCase().includes('messages') &&
    (err?.message?.includes('does not exist') || err?.code === '42P01')
}

const SQL_HINT = `-- Exécutez dans Supabase SQL Editor :
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON messages FOR ALL USING (true);`

export default function Messages({ onUnreadChange }) {
  const { user }  = useAuth()
  const isAdmin   = user.role === 'admin'
  const employees = getUsers().filter(u => u.role !== 'admin')

  const [messages,   setMessages]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [noTable,    setNoTable]    = useState(false)
  const [convId,     setConvId]     = useState(isAdmin ? (employees[0]?.id ?? 'all') : ADMIN_ID)
  const [input,      setInput]      = useState('')
  const [sending,    setSending]    = useState(false)
  const [sqlCopied,  setSqlCopied]  = useState(false)
  const bottomRef = useRef(null)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const msgs = await getMessages(user.id, isAdmin)
      setMessages(msgs)

      // Mark messages addressed to this user as read
      const toRead = msgs.filter(m =>
        !m.read &&
        m.from_user_id !== user.id &&
        (m.to_user_id === user.id || m.to_user_id === null)
      )
      await Promise.all(toRead.map(m => markMessageRead(m.id)))
      if (onUnreadChange) onUnreadChange(0)
    } catch (err) {
      if (isMissingTable(err)) setNoTable(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, convId])

  // Unread count per employee (for admin)
  const unreadFor = (empId) =>
    messages.filter(m => m.from_user_id === empId && !m.read).length

  // Conversation messages
  const conversation = (() => {
    if (isAdmin) {
      if (convId === 'all') return messages.filter(m => m.to_user_id === null)
      return messages.filter(m =>
        (m.from_user_id === convId && m.to_user_id === user.id) ||
        (m.from_user_id === user.id && m.to_user_id === convId)
      )
    }
    return messages.filter(m =>
      m.from_user_id === user.id ||
      m.to_user_id   === user.id ||
      m.to_user_id   === null
    )
  })()

  const sorted = [...conversation].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )

  const handleSend = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    try {
      const msg = {
        from_user_id: user.id,
        to_user_id: isAdmin
          ? convId === 'all' ? null : convId
          : ADMIN_ID,
        content: input.trim(),
        read: false,
      }
      await sendMessage(msg)
      setInput('')
      await load(true)
    } catch (err) {
      if (isMissingTable(err)) setNoTable(true)
    } finally {
      setSending(false)
    }
  }

  const copySql = () => {
    navigator.clipboard?.writeText(SQL_HINT).then(() => {
      setSqlCopied(true)
      setTimeout(() => setSqlCopied(false), 2000)
    })
  }

  if (noTable) {
    return (
      <div className="msg-wrap">
        <Breadcrumb items={['Cabinet Médical', 'Messages']} />
        <div className="card msg-missing">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>Table manquante</h3>
          <p>La table <code>messages</code> n'existe pas encore. Exécutez ce SQL dans votre projet Supabase :</p>
          <pre className="msg-sql">{SQL_HINT}</pre>
          <button className="btn btn-primary msg-copy-btn" onClick={copySql}>
            {sqlCopied ? '✓ Copié !' : 'Copier le SQL'}
          </button>
        </div>
      </div>
    )
  }

  const placeholder = isAdmin && convId === 'all'
    ? "Message à toute l'équipe…"
    : `Message à ${isAdmin ? getUserById(convId)?.name ?? '' : 'Dr. Bezioune'}…`

  return (
    <div className="msg-wrap">
      <Breadcrumb items={['Cabinet Médical', 'Messages']} />

      <div className="msg-container">

        {/* Sidebar conversations (admin only) */}
        {isAdmin && (
          <aside className="msg-sidebar">
            <div className="msg-sidebar-title">Conversations</div>

            <button
              className={`msg-conv-btn${convId === 'all' ? ' active' : ''}`}
              onClick={() => setConvId('all')}
            >
              <span className="msg-conv-av" style={{ background: '#6b7280' }}>T</span>
              <span className="msg-conv-name">Toute l'équipe</span>
            </button>

            {employees.map(emp => {
              const nb = unreadFor(emp.id)
              return (
                <button
                  key={emp.id}
                  className={`msg-conv-btn${convId === emp.id ? ' active' : ''}`}
                  onClick={() => setConvId(emp.id)}
                >
                  <span className="msg-conv-av" style={{ background: emp.color }}>{emp.name[0]}</span>
                  <span className="msg-conv-name">{emp.name}</span>
                  {nb > 0 && <span className="msg-badge-sm">{nb}</span>}
                </button>
              )
            })}
          </aside>
        )}

        {/* Chat area */}
        <div className="msg-chat">
          <div className="msg-chat-header">
            {isAdmin
              ? convId === 'all'
                ? "Message à toute l'équipe"
                : `Conversation avec ${getUserById(convId)?.name ?? ''}`
              : 'Conversation avec Dr. Bezioune'}
          </div>

          <div className="msg-list">
            {loading && <div className="loading-center" style={{ padding: '2rem' }}><div className="spinner" /></div>}

            {!loading && sorted.length === 0 && (
              <p className="msg-empty">Aucun message. Commencez la conversation !</p>
            )}

            {sorted.map(msg => {
              const mine   = msg.from_user_id === user.id
              const sender = getUserById(msg.from_user_id)
              const bcast  = msg.to_user_id === null

              return (
                <div key={msg.id} className={`msg-bubble-wrap${mine ? ' mine' : ''}`}>
                  {!mine && (
                    <div
                      className="msg-bubble-av"
                      style={{ background: sender?.color || '#6b7280' }}
                    >
                      {sender?.name?.[0] ?? '?'}
                    </div>
                  )}
                  <div className="msg-bubble-col">
                    {!mine && (
                      <span className="msg-bubble-sender">
                        {sender?.name ?? 'Inconnu'}
                        {bcast && <span className="msg-bcast-tag">Tous</span>}
                      </span>
                    )}
                    <div className={`msg-bubble${mine ? ' mine' : ''}`}>{msg.content}</div>
                    <span className="msg-bubble-time">
                      {format(new Date(msg.created_at), 'dd MMM HH:mm', { locale: fr })}
                      {mine && !msg.read && ' · Non lu'}
                    </span>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <div className="msg-input-bar">
            <input
              className="msg-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder={placeholder}
              disabled={sending}
            />
            <button
              className="msg-send-btn"
              onClick={handleSend}
              disabled={sending || !input.trim()}
              aria-label="Envoyer"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
