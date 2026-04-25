import { createContext, useContext, useState, useEffect } from 'react'

const USERS = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Imene',        pin: '0503', role: 'assistant' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Dessa',        pin: '2002', role: 'assistant' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Laëla',        pin: '2003', role: 'assistant' },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Dr. Bezioune', pin: '1234', role: 'admin'     },
]

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('cabinet_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
    setLoading(false)
  }, [])

  const login = (pin) => {
    const found = USERS.find(u => u.pin === pin.trim())
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
