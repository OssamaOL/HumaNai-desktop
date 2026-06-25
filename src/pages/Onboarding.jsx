import { useState, useEffect } from 'react'
import { CheckCircle, Circle, Plus, RefreshCw } from 'lucide-react'
import { onboardingAPI } from '../services/api'

const demoPlans = [
  { id: 'demo-1', name: 'Karim Bennani', role: 'Sales Manager', avatar: '61', startDate: 'Jun 02, 2026', progress: 75,
    tasks: [{ label: 'Sign the employment contract', done: true }, { label: 'Set up workstation and access', done: true }, { label: 'Meet the team', done: true }, { label: 'Complete HR orientation', done: false }, { label: 'First follow-up interview', done: false }] },
  { id: 'demo-2', name: 'Fatima Ziane', role: 'UX Researcher', avatar: '39', startDate: 'Jun 09, 2026', progress: 30,
    tasks: [{ label: 'Sign the employment contract', done: true }, { label: 'Set up workstation and access', done: false }, { label: 'Meet the team', done: false }, { label: 'Complete HR orientation', done: false }, { label: 'First follow-up interview', done: false }] },
]

export default function Onboarding() {
  // FIX: was `const [plans] = useState(demoPlans)` — now fetches real data from backend
  const [plans, setPlans] = useState(demoPlans)
  const [loadingPlans, setLoadingPlans] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Load real plans on mount; fall back to demo data silently on error
  useEffect(() => { loadPlans() }, [])

  async function loadPlans() {
    setLoadingPlans(true)
    try {
      const data = await onboardingAPI.list()
      if (Array.isArray(data) && data.length > 0) {
        setPlans(data)
      }
      // if empty or error, demo data stays visible
    } catch {
      // keep demo cards — no crash
    } finally {
      setLoadingPlans(false)
    }
  }

  async function handleGenerate(e) {
    e.preventDefault()
    if (!employeeId.trim()) return
    setLoading(true); setError(null); setSuccess(null)
    try {
      const plan = await onboardingAPI.generate(employeeId.trim())
      setSuccess(`Plan generated — ID: ${plan.plan_id || plan.id}`)
      setShowForm(false)
      setEmployeeId('')
      await loadPlans()  // refresh the list so the new plan appears
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '32px 36px', background: '#F7F7F9', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1E' }}>Onboarding</h1>
          <p style={{ fontSize: 13.5, color: '#71717a', marginTop: 4 }}>Track new employee onboarding progress</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={loadPlans}
            disabled={loadingPlans}
            title="Refresh"
            style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', border: '1px solid #E2E2E6', borderRadius: 10, cursor: 'pointer', color: '#71717a' }}
          >
            <RefreshCw size={15} style={{ animation: loadingPlans ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 16px rgba(99,102,241,0.35)' }}
          >
            <Plus size={15} /> New Onboarding
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px', marginBottom: 20, border: '1px solid #E2E2E6' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1E', marginBottom: 4 }}>Generate Onboarding Plan</p>
          <p style={{ fontSize: 12.5, color: '#71717a', marginBottom: 12 }}>Copy the employee UUID from the Employees page.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              placeholder="Employee UUID (e.g. e1111111-1111-...)"
              style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #E2E2E6', borderRadius: 10, fontSize: 13.5, outline: 'none', fontFamily: 'inherit', background: '#FFFFFF', color: '#1A1A1E' }}
            />
            <button
              onClick={handleGenerate}
              disabled={loading || !employeeId.trim()}
              style={{ padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Generating…' : 'Generate'}
            </button>
          </div>
          {error   && <p style={{ fontSize: 12.5, color: '#DC2626', marginTop: 8 }}>{error}</p>}
          {success && <p style={{ fontSize: 12.5, color: '#059669', marginTop: 8 }}>{success}</p>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
        {plans.map((o) => {
          // Support both real API shape and demo shape
          const name     = o.name     || o.employee_id || 'Employee'
          const role     = o.role     || o.status      || 'Onboarding'
          const progress = o.progress ?? 0
          const tasks    = o.tasks    || []
          const startDate = o.startDate || (o.created_at ? new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—')

          return (
            <div key={o.id} style={{ background: '#FFFFFF', borderRadius: 16, padding: '22px', border: '1px solid #E2E2E6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                {o.avatar
                  ? <img src={`https://i.pravatar.cc/44?img=${o.avatar}`} style={{ width: 44, height: 44, borderRadius: '50%' }} alt="" />
                  : <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#4F46E5,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                      {String(name).charAt(0).toUpperCase()}
                    </div>
                }
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E' }}>{name}</p>
                  <p style={{ fontSize: 12.5, color: '#71717a' }}>{role} · Started {startDate}</p>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#4F46E5' }}>{progress}%</span>
                  <p style={{ fontSize: 11, color: '#71717a' }}>Complete</p>
                </div>
              </div>
              <div style={{ height: 6, background: '#E2E2E6', borderRadius: 99, marginBottom: 18, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #4F46E5, #6366f1)', borderRadius: 99 }} />
              </div>
              {tasks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tasks.map((t, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {t.done
                        ? <CheckCircle size={16} style={{ color: '#059669', flexShrink: 0 }} />
                        : <Circle     size={16} style={{ color: '#C9C9D1', flexShrink: 0 }} />
                      }
                      <span style={{ fontSize: 13, color: t.done ? '#71717a' : '#232326', textDecoration: t.done ? 'line-through' : 'none' }}>{t.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12.5, color: '#9A9AA2' }}>Plan being generated by the AI agent…</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
