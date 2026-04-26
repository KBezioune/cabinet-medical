import { createContext, useContext, useState, useEffect } from 'react'
import { getUsers } from '../lib/localData'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('cabinet_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
    setLoading(false)
  }, [])

  const login = (pin) => {
    // Appel dynamique pour lire les PINs potentiellement modifiés
    const found = getUsers().find(u => u.pin === pin.trim())
    if (!found) throw new Error('PIN incorrect')
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
