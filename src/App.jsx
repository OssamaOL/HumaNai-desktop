import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Absences from './pages/Absences'
import Documents from './pages/Documents'
import Assistant from './pages/Assistant'
import Onboarding from './pages/Onboarding'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

function MainApp() {
  const { user } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')

  if (!user) return <Login />

  function renderPage() {
    if (activePage === 'dashboard') return <Dashboard onNavigate={setActivePage} />
    if (activePage === 'employees') return <Employees />
    if (activePage === 'absences') return <Absences />
    if (activePage === 'documents') return <Documents />
    if (activePage === 'assistant') return <Assistant />
    if (activePage === 'onboarding') return <Onboarding />
    if (activePage === 'analytics') return <Analytics />
    if (activePage === 'settings') return <Settings />
    return <Dashboard onNavigate={setActivePage} />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#F7F7F9' }}>
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <TopBar onNavigate={setActivePage} />
        <div style={{ flex: 1, overflow: 'auto' }}>
          {renderPage()}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}
