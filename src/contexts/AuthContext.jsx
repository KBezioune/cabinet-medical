import { createContext, useContext, useState, useEffect } from 'react'
import { getUsers } from '../lib/localData'
import { syncPinsFromDb, logAccess } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('cabinet_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
    setLoading(false)

    // Synchroniser les mots de passe depuis Supabase en arrière-plan
    syncPinsFromDb().catch(() => {})
  }, [])

  const login = async (password) => {
    const found = getUsers().find(u => u.pin === password.trim())
    const ua    = navigator.userAgent

    if (!found) {
      // Log tentative échouée (non bloquant)
      logAccess({ userId: null, action: 'login_failure', userAgent: ua }).catch(() => {})
      throw new Error('Mot de passe incorrect')
    }

    // Log connexion réussie (non bloquant)
    logAccess({ userId: found.id, action: 'login_success', userAgent: ua }).catch(() => {})

    sessionStorage.setItem('cabinet_user', JSON.stringify(found))
    setUser(found)
    return found
  }

  const logout = () => {
    sessionStorage.removeItem('cabinet_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
