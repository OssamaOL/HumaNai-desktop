import { useEffect, useState } from 'react'
import { Plus, RefreshCw, CheckCircle, Circle, ChevronDown, ChevronUp, LogOut } from 'lucide-react'
import { offboardingAPI, employeesAPI } from '../services/api'

const STATUS_META = {
  initiated:    { label: 'Initié',      color: '#4F46E5', bg: 'rgba(99,102,241,0.12)'  },
  in_progress:  { label: 'En cours',    color: '#B45309', bg: 'rgba(245,158,11,0.12)'  },
  completed:    { label: 'Clôturé',     color: '#059669', bg: 'rgba(16,185,129,0.12)'  },
  cancelled:    { label: 'Annulé',      color: '#DC2626', bg: 'rgba(239,68,68,0.12)'   },
}

const REASON_LABELS = {
  resignation:   'Démission',
  retirement:    'Retraite',
  dismissal:     'Licenciement',
  mutual_agreement: 'Rupture conventionnelle',
  end_of_contract: 'Fin de contrat',
}

const STEP_TYPE_LABELS = {
  materiel:  '💻 Matériel',
  acces:     '🔑 Accès',
  admin:     '📋 Administratif',
  transfert: '📦 Transfert',
  cloture:   '✅ Clôture',
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Offboarding() {
  const [workflows, setWorkflows]   = useState([])
  const [employees, setEmployees]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [showForm, setShowForm]     = useState(false)
  const [expanded, setExpanded]     = useState(null)
  const [checklist, setChecklist]   = useState({})
  const [loadingCl, setLoadingCl]   = useState(null)

  // Form state
  const [empId, setEmpId]           = useState('')
  const [reason, setReason]         = useState('resignation')
  const [depDate, setDepDate]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState(null)
  const [formSuccess, setFormSuccess] = useState(null)

  const inputStyle = { padding: '9px 13px', border: '1.5px solid #E2E2E6', borderRadius: 10, fontSize: 13.5, outline: 'none', fontFamily: 'inherit', background: '#FFFFFF', color: '#1A1A1E', width: '100%' }

  async function load() {
    setLoading(true); setError(null)
    try {
      const [wf, emps] = await Promise.all([offboardingAPI.list(), employeesAPI.list()])
      setWorkflows(Array.isArray(wf) ? wf : [])
      setEmployees(Array.isArray(emps) ? emps : [])
      if (!empId && emps?.length) setEmpId(emps[0].id)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleExpand(wf) {
    const id = wf.id
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!checklist[id]) {
      setLoadingCl(id)
      try {
        const data = await offboardingAPI.checklist(id)
        setChecklist(prev => ({ ...prev, [id]: data }))
      } catch { /* checklist unavailable */ }
      finally { setLoadingCl(null) }
    }
  }

  async function handleInitiate(e) {
    e.preventDefault()
    if (!empId || !depDate) return
    setSubmitting(true); setFormError(null); setFormSuccess(null)
    try {
      const result = await offboardingAPI.initiate(empId, reason, depDate)
      setFormSuccess(`Workflow initié — ID: ${result.id?.slice(0, 8)}`)
      setShowForm(false)
      await load()
    } catch (e) { setFormError(e.message) }
    finally { setSubmitting(false) }
  }

  async function handleComplete(id) {
    try {
      await offboardingAPI.complete(id)
      setWorkflows(prev => prev.map(w => w.id === id ? { ...w, status: 'completed' } : w))
    } catch (e) { alert(e.message) }
  }

  const counts = { initiated: 0, in_progress: 0, completed: 0 }
  workflows.forEach(w => { if (counts[w.status] !== undefined) counts[w.status]++ })

  return (
    <div style={{ padding: '32px 36px', background: '#F7F7F9', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1E' }}>Offboarding</h1>
          <p style={{ fontSize: 13.5, color: '#71717a', marginTop: 4 }}>Gestion des départs et checklists de conformité</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} disabled={loading} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', border: '1px solid #E2E2E6', borderRadius: 10, cursor: 'pointer', color: '#71717a' }}>
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 16px rgba(99,102,241,0.3)' }}>
            <Plus size={15} /> Initier un départ
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'En cours',   value: counts.initiated + counts.in_progress, color: '#4F46E5' },
          { label: 'Clôturés',   value: counts.completed,                      color: '#059669' },
          { label: 'Total',      value: workflows.length,                      color: '#44444B' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px', border: '1px solid #E2E2E6' }}>
            <p style={{ fontSize: 12.5, color: '#44444B', fontWeight: 600, marginBottom: 10 }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color }}>{loading ? '…' : value}</p>
          </div>
        ))}
      </div>

      {/* Initiate form */}
      {showForm && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 20, marginBottom: 20, border: '1px solid #E2E2E6' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1E', marginBottom: 12 }}>Initier un départ</p>
          <form onSubmit={handleInitiate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select value={empId} onChange={e => setEmpId(e.target.value)} required style={inputStyle}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.matricule})</option>)}
            </select>
            <select value={reason} onChange={e => setReason(e.target.value)} required style={inputStyle}>
              {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" value={depDate} onChange={e => setDepDate(e.target.value)} required style={inputStyle} placeholder="Date de départ" />
            <button type="submit" disabled={submitting} style={{ padding: '10px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Traitement…' : 'Initier le départ'}
            </button>
          </form>
          {formError   && <p style={{ fontSize: 12.5, color: '#DC2626', marginTop: 8 }}>{formError}</p>}
          {formSuccess && <p style={{ fontSize: 12.5, color: '#059669', marginTop: 8 }}>{formSuccess}</p>}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
          {error}
        </div>
      )}

      {/* Workflow list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? <p style={{ color: '#71717a', fontSize: 13.5 }}>Chargement…</p>
        : workflows.length === 0 ? (
          <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', padding: 40, textAlign: 'center', color: '#71717a', fontSize: 13.5 }}>
            Aucun départ en cours.
          </div>
        ) : workflows.map(w => {
          const meta   = STATUS_META[w.status] || STATUS_META.initiated
          const isOpen = expanded === w.id
          const cl     = checklist[w.id] || {}
          const emp    = employees.find(e => e.id === w.employee_id)

          return (
            <div key={w.id} style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', overflow: 'hidden' }}>
              <div onClick={() => handleExpand(w)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <LogOut size={20} style={{ color: meta.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1E' }}>
                      {emp ? emp.full_name : `Employé #${w.employee_id?.slice(0, 8)}`}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 99 }}>{meta.label}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: '#71717a' }}>
                    {REASON_LABELS[w.departure_reason] || w.departure_reason} · Départ prévu le {fmtDate(w.departure_date)}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {w.status !== 'completed' && (
                    <button onClick={e => { e.stopPropagation(); handleComplete(w.id) }} style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Clôturer
                    </button>
                  )}
                  {isOpen ? <ChevronUp size={16} color="#71717a" /> : <ChevronDown size={16} color="#71717a" />}
                </div>
              </div>

              {/* Expanded checklist */}
              {isOpen && (
                <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid #F2F2F4' }}>
                  {loadingCl === w.id ? (
                    <p style={{ fontSize: 13, color: '#71717a', paddingTop: 12 }}>Chargement de la checklist…</p>
                  ) : Object.keys(cl).length === 0 ? (
                    <p style={{ fontSize: 13, color: '#9A9AA2', paddingTop: 12 }}>Aucune étape disponible — la génération IA est en cours.</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginTop: 16 }}>
                      {Object.entries(cl).map(([type, steps]) => (
                        <div key={type} style={{ background: '#F7F7F9', borderRadius: 10, padding: '14px' }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#44444B', marginBottom: 10 }}>{STEP_TYPE_LABELS[type] || type}</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {steps.length === 0 ? <p style={{ fontSize: 12, color: '#9A9AA2' }}>Aucune étape</p>
                            : steps.map(s => (
                              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {s.completed_at
                                  ? <CheckCircle size={14} style={{ color: '#059669', flexShrink: 0 }} />
                                  : <Circle size={14} style={{ color: '#C9C9D1', flexShrink: 0 }} />
                                }
                                <span style={{ fontSize: 12.5, color: s.completed_at ? '#71717a' : '#232326', textDecoration: s.completed_at ? 'line-through' : 'none' }}>{s.title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
