import { useState, useEffect, useRef } from 'react'
import { Search, Calendar, HelpCircle, Bell, LogOut, X, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { alertsAPI } from '../services/api'

const roleBadge = {
  admin:         { color: '#DC2626', bg: 'rgba(239,68,68,0.12)' },
  rh:            { color: '#4F46E5', bg: 'rgba(99,102,241,0.12)' },
  manager:       { color: '#B45309', bg: 'rgba(245,158,11,0.12)' },
  collaborateur: { color: '#059669', bg: 'rgba(16,185,129,0.12)' },
  direction:     { color: '#2563EB', bg: 'rgba(59,130,246,0.12)' },
  qvt:           { color: '#9333EA', bg: 'rgba(168,85,247,0.12)' },
}

const SEVERITY_ICON = {
  critical: { Icon: AlertTriangle, color: '#DC2626' },
  high:     { Icon: AlertTriangle, color: '#B45309' },
  medium:   { Icon: Info,          color: '#4F46E5' },
  low:      { Icon: CheckCircle,   color: '#059669' },
}

const QUICK_LINKS = [
  { label: 'Tableau de bord',  page: 'dashboard' },
  { label: 'Collaborateurs',  page: 'employees' },
  { label: 'Absences',   page: 'absences'  },
  { label: 'Documents',       page: 'documents' },
  { label: 'Analytique',  page: 'analytics' },
  { label: 'Intégration', page: 'onboarding'},
  { label: 'Assistant IA', page: 'assistant'},
  { label: 'Paramètres',   page: 'settings'  },
]

export default function TopBar({ onNavigate }) {
  const { user, logout } = useAuth()
  const badge = roleBadge[user?.role] || { color: '#44444B', bg: '#F2F2F4' }

  const [search, setSearch]         = useState('')
  const [showHelp, setShowHelp]     = useState(false)
  const [showBell, setShowBell]     = useState(false)
  const [alerts, setAlerts]         = useState([])
  const [alertsLoaded, setAlertsLoaded] = useState(false)

  const bellRef = useRef(null)
  const helpRef = useRef(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function onMouseDown(e) {
      if (showBell && bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false)
      if (showHelp && helpRef.current && !helpRef.current.contains(e.target)) setShowHelp(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [showBell, showHelp])

  // Load alerts when bell is first opened
  async function handleBell() {
    setShowBell(v => !v)
    if (!alertsLoaded) {
      try { setAlerts(await alertsAPI.list()); setAlertsLoaded(true) }
      catch { setAlerts([]) }
    }
  }

  // Search: filter quick links and navigate on Enter
  const searchResults = search.length > 0
    ? QUICK_LINKS.filter(l => l.label.toLowerCase().includes(search.toLowerCase()))
    : []

  function handleSearchKey(e) {
    if (e.key === 'Enter' && searchResults.length > 0) {
      onNavigate(searchResults[0].page); setSearch('')
    }
    if (e.key === 'Escape') setSearch('')
  }

  const iconBtn = (active) => ({
    width: 36, height: 36, borderRadius: 10, border: active ? '1px solid #E2E2E6' : 'none',
    background: active ? '#F7F7F9' : 'transparent',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a',
  })

  return (
    <div style={{ height: 60, minHeight: 60, background: '#FFFFFF', borderBottom: '1px solid #E2E2E6', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 12, position: 'relative', zIndex: 100 }}>

      {/* Search */}
      <div style={{ position: 'relative', width: 280 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9A9AA2', pointerEvents: 'none' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearchKey}
          placeholder="Rechercher une page…"
          style={{ width: '100%', padding: '9px 16px 9px 36px', background: '#F7F7F9', border: '1px solid #E2E2E6', borderRadius: 10, fontSize: 13.5, color: '#1A1A1E', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        {searchResults.length > 0 && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', background: '#FFFFFF', border: '1px solid #E2E2E6', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', overflow: 'hidden', zIndex: 200 }}>
            {searchResults.map(r => (
              <button key={r.page} onClick={() => { onNavigate(r.page); setSearch('') }} style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13.5, color: '#1A1A1E', cursor: 'pointer', borderBottom: '1px solid #F2F2F4', fontFamily: 'inherit' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F7F7F9'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >{r.label}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Icon buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>

        {/* Calendar → Absences */}
        <button onClick={() => onNavigate('absences')} title="Calendrier des absences" style={iconBtn(false)}>
          <Calendar size={18} strokeWidth={1.8} />
        </button>

        {/* Help */}
        <div ref={helpRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowHelp(v => !v)} title="Help" style={iconBtn(showHelp)}>
            <HelpCircle size={18} strokeWidth={1.8} />
          </button>
          {showHelp && (
            <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 260, background: '#FFFFFF', border: '1px solid #E2E2E6', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,0.1)', padding: '16px', zIndex: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E' }}>Quick Help</span>
                <button onClick={() => setShowHelp(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9AA2' }}><X size={14} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { title: 'Générer un document', desc: 'Allez dans Documents → Générer un document, choisissez un template et un collaborateur.' },
                  { title: 'Approuver des absences', desc: 'Allez dans Absences et cliquez sur Approuver ou Refuser les demandes en attente.' },
                  { title: 'Assistant IA', desc: 'Discutez avec l\'IA dans la page Assistant — elle lit vos documents RH.' },
                  { title: 'Analytique & KPIs', desc: 'Allez dans Analytique → cliquez sur Calculer les KPIs pour rafraîchir vos métriques.' },
                ].map(({ title, desc }) => (
                  <div key={title} style={{ padding: '10px 12px', background: '#F7F7F9', borderRadius: 10 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A1E', marginBottom: 3 }}>{title}</div>
                    <div style={{ fontSize: 11.5, color: '#71717a', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #E2E2E6', fontSize: 11.5, color: '#9A9AA2' }}>HumaNai · YDAYS 2026 · Ynov Campus</div>
            </div>
          )}
        </div>

        {/* Bell */}
        <div ref={bellRef} style={{ position: 'relative' }}>
          <button onClick={handleBell} title="Alerts" style={iconBtn(showBell)}>
            <Bell size={18} strokeWidth={1.8} />
            {alertsLoaded && alerts.length > 0 && (
              <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#DC2626', border: '2px solid #FFFFFF' }} />
            )}
          </button>
          {showBell && (
            <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 320, background: '#FFFFFF', border: '1px solid #E2E2E6', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,0.1)', zIndex: 200, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #E2E2E6' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E' }}>Alerts {alerts.length > 0 && `(${alerts.length})`}</span>
                <button onClick={() => setShowBell(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9AA2' }}><X size={14} /></button>
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#9A9AA2', fontSize: 13 }}>
                    <CheckCircle size={24} style={{ marginBottom: 8, color: '#059669' }} /><br />No active alerts
                  </div>
                ) : (
                  alerts.slice(0, 8).map((a, i) => {
                    const sev = SEVERITY_ICON[a.severity] || SEVERITY_ICON.medium
                    return (
                      <div key={a.id || i} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid #F2F2F4', alignItems: 'flex-start' }}>
                        <sev.Icon size={15} style={{ color: sev.color, flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A1E' }}>{a.alert_type?.replace(/_/g, ' ')}</div>
                          <div style={{ fontSize: 11.5, color: '#71717a' }}>{a.triggered_at ? new Date(a.triggered_at).toLocaleDateString() : ''}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              {alerts.length > 0 && (
                <button onClick={() => { onNavigate('analytics'); setShowBell(false) }} style={{ width: '100%', padding: '12px', background: '#F7F7F9', border: 'none', fontSize: 12.5, color: '#4F46E5', fontWeight: 600, cursor: 'pointer', borderTop: '1px solid #E2E2E6', fontFamily: 'inherit' }}>
                  View all in Analytics →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: '#E2E2E6' }} />

      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
          {(user?.full_name || 'U').charAt(0).toUpperCase()}
        </div>
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1E' }}>{user?.full_name || 'Utilisateur'}</div>
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 99, color: badge.color, background: badge.bg, textTransform: 'capitalize' }}>{user?.role || ''}</span>
        </div>
        <button onClick={logout} title="Déconnexion" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E2E6', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A9AA2', marginLeft: 4 }}>
          <LogOut size={14} />
        </button>
      </div>
    </div>
  )
}
