import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import Layout from './components/Layout'
import AssistantDashboard from './components/assistant/AssistantDashboard'
import AdminDashboard from './components/admin/AdminDashboard'
import DbStatus from './components/DbStatus'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <Layout>
      {/* admin et manager → dashboard admin (avec onglets filtrés selon rôle) */}
      {(user.role === 'admin' || user.role === 'manager')
        ? <AdminDashboard />
        : <AssistantDashboard />
      }
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <DbStatus />
    </AuthProvider>
  )
}
