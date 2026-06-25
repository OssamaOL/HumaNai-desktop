import { useState, useEffect } from 'react'
import { Users, CalendarOff, TrendingUp, Award, AlertTriangle, CheckCircle, Clock, RefreshCw, ArrowRight } from 'lucide-react'
import { dashboardAPI, alertsAPI, employeesAPI, absencesAPI } from '../services/api'

const STATUS_STYLE = {
  actif:     { label: 'Actif',      color: '#059669', bg: 'rgba(16,185,129,0.15)' },
  inactif:   { label: 'Inactif',    color: '#DC2626', bg: 'rgba(239,68,68,0.15)' },
  en_sortie: { label: 'En sortie',  color: '#B45309', bg: 'rgba(245,158,11,0.15)' },
}
const ALERT_SEV = {
  critical: { color: '#DC2626', bg: 'rgba(239,68,68,0.15)',  Icon: AlertTriangle },
  high:     { color: '#B45309', bg: 'rgba(245,158,11,0.15)', Icon: AlertTriangle },
  medium:   { color: '#4F46E5', bg: 'rgba(99,102,241,0.15)', Icon: Clock },
  low:      { color: '#059669', bg: 'rgba(16,185,129,0.15)', Icon: CheckCircle },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000)
  if (diff < 60) return `${diff}min`
  if (diff < 1440) return `${Math.floor(diff / 60)}h`
  return `${Math.floor(diff / 1440)}j`
}

function Avatar({ name }) {
  const initials = name ? name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase() : '?'
  const hue = name ? (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 50) * 17) % 360 : 200
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: `hsl(${hue},55%,48%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

export default function Dashboard({ onNavigate }) {
  const [kpis, setKpis]             = useState(null)
  const [alerts, setAlerts]         = useState([])
  const [employees, setEmployees]   = useState([])
  const [absences, setAbsences]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [backendOnline, setBackendOnline] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [kpiData, alertData, empData, absData] = await Promise.allSettled([
        dashboardAPI.kpis(),
        alertsAPI.list(),
        employeesAPI.list(),
        absencesAPI.list(),
      ])
      if (kpiData.status === 'fulfilled')   { setKpis(kpiData.value); setBackendOnline(true) }
      if (alertData.status === 'fulfilled') setAlerts(Array.isArray(alertData.value) ? alertData.value : [])
      if (empData.status === 'fulfilled')   setEmployees(Array.isArray(empData.value) ? empData.value : [])
      if (absData.status === 'fulfilled')   setAbsences(Array.isArray(absData.value) ? absData.value : [])
    } catch { setBackendOnline(false) }
    finally { setLoading(false) }
  }

  // Build KPI cards from real data when available
  // New backend: kpis = { total_employees, active_employees, scope, period }
  const latest = kpis || null
  const pendingAbsences = absences.filter(a => a.status === 'pending').length
  const activeEmployees = employees.filter(e => e.status === 'actif').length

  const kpiCards = [
    {
      icon: Users, label: 'Total Collaborateurs',
      value: loading ? '…' : (latest?.total_employees ?? employees.length ?? '—'),
      sub: `${latest?.active_employees ?? activeEmployees} actifs`,
      color: '#4F46E5', bg: 'rgba(99,102,241,0.12)',
    },
    {
      icon: CalendarOff, label: 'Absences en attente',
      value: loading ? '…' : pendingAbsences,
      sub: `${absences.length} au total`,
      color: '#B45309', bg: 'rgba(245,158,11,0.12)',
    },
    {
      icon: TrendingUp, label: 'Taux de turnover',
      value: loading ? '…' : (latest?.turnover_rate ? `${Number(latest.turnover_rate).toFixed(1)}%` : '—'),
      sub: 'Ce mois',
      color: '#DC2626', bg: 'rgba(239,68,68,0.12)',
    },
    {
      icon: Award, label: 'Score d\'engagement',
      value: loading ? '…' : (latest?.engagement_score ? `${Number(latest.engagement_score).toFixed(0)}/10` : '—'),
      sub: 'Score moyen équipe',
      color: '#059669', bg: 'rgba(16,185,129,0.12)',
    },
  ]

  const cardStyle = { background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6' }

  return (
    <div style={{ padding: '32px 36px', background: '#F7F7F9', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1E' }}>Tableau de bord</h1>
          <p style={{ fontSize: 13.5, color: '#71717a', marginTop: 6 }}>Vue d'ensemble de votre activité RH</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', ...cardStyle }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: backendOnline ? '#059669' : '#B45309' }} />
            <span style={{ fontSize: 12, color: '#44444B', fontWeight: 500 }}>{backendOnline ? 'Backend connecté' : 'Mode démo'}</span>
          </div>
          <button onClick={loadAll} title="Actualiser" style={{ width: 36, height: 36, borderRadius: 10, ...cardStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#44444B' }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {kpiCards.map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div key={label} style={{ ...cardStyle, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#44444B' }}>{label}</span>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#1A1A1E', marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 12, color: '#71717a' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Bottom two panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Alertes */}
        <div style={{ ...cardStyle, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E' }}>Alertes récentes</h2>
            <button onClick={() => onNavigate?.('analytics')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4F46E5', cursor: 'pointer', fontWeight: 600, background: 'none', border: 'none' }}>
              Voir tout <ArrowRight size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <p style={{ fontSize: 13, color: '#9A9AA2', textAlign: 'center', padding: '16px 0' }}>Chargement…</p>
            ) : alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle size={24} style={{ color: '#059669', marginBottom: 6 }} />
                <p style={{ fontSize: 13, color: '#71717a' }}>Aucune alerte active</p>
              </div>
            ) : (
              alerts.slice(0, 5).map((a, i) => {
                const sev = ALERT_SEV[a.severity] || ALERT_SEV.medium
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#F7F7F9' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: sev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <sev.Icon size={15} style={{ color: sev.color }} />
                    </div>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: '#232326', flex: 1 }}>
                      {a.alert_type?.replace(/_/g, ' ')}
                    </p>
                    <span style={{ fontSize: 11, color: '#71717a', whiteSpace: 'nowrap' }}>{timeAgo(a.triggered_at)}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Collaborateurs récents */}
        <div style={{ ...cardStyle, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E' }}>Collaborateurs récents</h2>
            <button onClick={() => onNavigate?.('employees')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4F46E5', cursor: 'pointer', fontWeight: 600, background: 'none', border: 'none' }}>
              Voir tout <ArrowRight size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <p style={{ fontSize: 13, color: '#9A9AA2', textAlign: 'center', padding: '16px 0' }}>Chargement…</p>
            ) : employees.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9A9AA2', textAlign: 'center', padding: '16px 0' }}>Aucun collaborateur</p>
            ) : (
              employees.slice(0, 4).map((emp, i) => {
                const s = STATUS_STYLE[emp.status] || { label: emp.status, color: '#44444B', bg: '#F2F2F4' }
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#F7F7F9' }}>
                    <Avatar name={emp.full_name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#232326' }}>{emp.full_name}</p>
                      <p style={{ fontSize: 11.5, color: '#71717a' }}>{emp.contract_type || '—'}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>{s.label}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
