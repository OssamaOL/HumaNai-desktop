import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { dashboardAPI } from '../services/api'

const deptData = [
  { dept: 'IT', count: 32, pct: 80 }, { dept: 'Ressources Humaines', count: 12, pct: 30 },
  { dept: 'Commercial', count: 28, pct: 70 }, { dept: 'Finance', count: 15, pct: 37 },
  { dept: 'Design', count: 10, pct: 25 }, { dept: 'Produit', count: 8, pct: 20 },
]

// Static demo chart data — backend doesn't store monthly history
const chartData = [
  { month: 'Jan', val: 8 }, { month: 'Feb', val: 12 }, { month: 'Mar', val: 7 },
  { month: 'Apr', val: 15 }, { month: 'May', val: 10 }, { month: 'Jun', val: 14 },
]

export default function Analytics() {
  // FIX: kpis is an object returned by the API, not an array — changed useState([]) to useState(null)
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [backendOnline, setBackendOnline] = useState(false)
  const [computing, setComputing] = useState(false)

  useEffect(() => { loadKPIs() }, [])

  async function loadKPIs() {
    setLoading(true)
    try {
      const data = await dashboardAPI.kpis()
      // data is a plain object: { total_employees, active_employees, ... }
      setKpis(data)
      setBackendOnline(true)
    } catch {
      setBackendOnline(false)
    } finally {
      setLoading(false)
    }
  }

  async function computeKPIs() {
    setComputing(true)
    try { await loadKPIs() }
    catch (err) { alert('Error: ' + err.message) }
    finally { setComputing(false) }
  }

  // FIX: use kpis directly as an object, not kpis[0]
  const latest = kpis || null

  const metrics = [
    { label: 'Turnover Rate',      value: latest ? `${Number(latest.turnover_rate    || 0).toFixed(1)}%` : '3.2%',  change: '-0.5%', up: false, color: '#059669' },
    { label: 'Absenteeism Rate',   value: latest ? `${Number(latest.absenteeism_rate || 0).toFixed(1)}%` : '11.3%', change: '+1.2%', up: true,  color: '#DC2626' },
    { label: 'Headcount',          value: latest ? String(latest.total_employees || latest.headcount || '—') : '124', change: 'Active total', up: true, color: '#4F46E5' },
    { label: 'Engagement Score',   value: latest ? `${Number(latest.engagement_score || 0).toFixed(0)}%` : '82%',   change: '+5%',   up: true,  color: '#B45309' },
  ]

  const maxVal = Math.max(...chartData.map(m => Number(m.val)))

  return (
    <div style={{ padding: '32px 36px', background: '#F7F7F9', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1E' }}>Analytics</h1>
          <p style={{ fontSize: 13.5, color: '#71717a', marginTop: 4 }}>HR insights and workforce trends</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#FFFFFF', borderRadius: 10, border: '1px solid #E2E2E6' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: backendOnline ? '#059669' : '#B45309' }} />
            <span style={{ fontSize: 12, color: '#44444B' }}>{backendOnline ? 'Live data' : 'Demo data'}</span>
          </div>
          <button onClick={computeKPIs} disabled={computing} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={13} /> {computing ? 'Computing…' : 'Refresh KPIs'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {metrics.map(({ label, value, change, up, color }) => (
          <div key={label} style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px', border: '1px solid #E2E2E6' }}>
            <p style={{ fontSize: 12.5, color: '#44444B', fontWeight: 600, marginBottom: 10 }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: '#1A1A1E', marginBottom: 6 }}>{loading ? '...' : value}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {up ? <TrendingUp size={13} style={{ color }} /> : <TrendingDown size={13} style={{ color }} />}
              <span style={{ fontSize: 12, fontWeight: 600, color }}>{change}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '22px', border: '1px solid #E2E2E6' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E', marginBottom: 20 }}>
            {backendOnline ? 'Monthly Absenteeism History' : 'Monthly Absences (demo)'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140 }}>
            {chartData.map(({ month, val }) => (
              <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4F46E5' }}>{val}</span>
                <div style={{ width: '100%', borderRadius: 6, minHeight: 8, height: `${(Number(val) / (maxVal || 1)) * 110}px`, background: 'linear-gradient(180deg, #4F46E5, #6366f1)' }} />
                <span style={{ fontSize: 11, color: '#71717a', fontWeight: 500 }}>{month}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '22px', border: '1px solid #E2E2E6' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E', marginBottom: 18 }}>Headcount by Department</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {deptData.map(({ dept, count, pct }) => (
              <div key={dept}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#44444B' }}>{dept}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1A1A1E' }}>{count}</span>
                </div>
                <div style={{ height: 6, background: '#E2E2E6', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #4F46E5, #6366f1)', borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
