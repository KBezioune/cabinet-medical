import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { getUsers } from '../lib/localData'
import { syncPinsFromDb, logAccess } from '../lib/db'

const AuthContext   = createContext(null)
const TIMEOUT_MS    = 20 * 60 * 1000 // 20 minutes
const ACTIVITY_EVT  = ['click', 'keydown', 'scroll', 'touchstart']

export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const timerRef = useRef(null)

  // Restauration de session au démarrage
  useEffect(() => {
    const stored = sessionStorage.getItem('cabinet_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
    setLoading(false)
    syncPinsFromDb().catch(() => {})
  }, [])

  // Timeout d'inactivité — actif uniquement quand l'utilisateur est connecté
  useEffect(() => {
    if (!user) {
      clearTimeout(timerRef.current)
      return
    }

    const expire = () => {
      clearTimeout(timerRef.current)
      sessionStorage.removeItem('cabinet_user')
      setUser(null)
      setSessionExpired(true)
    }

    const reset = () => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(expire, TIMEOUT_MS)
    }

    ACTIVITY_EVT.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset() // démarre le timer immédiatement

    return () => {
      clearTimeout(timerRef.current)
      ACTIVITY_EVT.forEach(e => window.removeEventListener(e, reset))
    }
  }, [user])

  const login = async (password) => {
    const found = getUsers().find(u => u.pin === password.trim())
    const ua    = navigator.userAgent

    if (!found) {
      logAccess({ userId: null, action: 'login_failure', userAgent: ua }).catch(() => {})
      throw new Error('Mot de passe incorrect')
    }

    logAccess({ userId: found.id, action: 'login_success', userAgent: ua }).catch(() => {})
    sessionStorage.setItem('cabinet_user', JSON.stringify(found))
    setSessionExpired(false)
    setUser(found)
    return found
  }

  const logout = () => {
    sessionStorage.removeItem('cabinet_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, sessionExpired }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
