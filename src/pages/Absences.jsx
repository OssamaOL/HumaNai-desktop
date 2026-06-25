import { useEffect, useState } from 'react'
import { Check, X, Clock, RefreshCw, AlertCircle } from 'lucide-react'
import { absencesAPI } from '../services/api'

const TYPE_LABEL = {
  'congé_payé': 'Congé payé',
  'maladie':    'Maladie',
  'sans_solde': 'Sans solde',
  'autre':      'Autre',
}

const STATUS = {
  approved: { label: 'Approuvé', color: '#059669', bg: 'rgba(16,185,129,0.12)', Icon: Check },
  pending:  { label: 'En attente',  color: '#B45309', bg: 'rgba(245,158,11,0.12)',  Icon: Clock },
  rejected: { label: 'Refusé', color: '#DC2626', bg: 'rgba(239,68,68,0.12)',  Icon: X },
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Absences() {
  const [absences, setAbsences]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [updating, setUpdating]     = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try { setAbsences(await absencesAPI.list()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function changeStatus(id, newStatus) {
    setUpdating(id)
    try {
      if (newStatus === 'approved') {
        await absencesAPI.approve(id)
      } else if (newStatus === 'rejected') {
        await absencesAPI.reject(id, 'Refusé par le gestionnaire')
      }
      setAbsences(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    } catch (e) { alert(e.message) }
    finally { setUpdating(null) }
  }

  const counts = { approved: 0, pending: 0, rejected: 0 }
  absences.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++ })

  const stats = [
    { label: 'Total',    value: absences.length,    color: '#4F46E5' },
    { label: 'Approuvé', value: counts.approved,    color: '#059669' },
    { label: 'En attente',  value: counts.pending,     color: '#B45309' },
    { label: 'Refusé', value: counts.rejected,    color: '#DC2626' },
  ]

  return (
    <div style={{ padding: '32px 36px', background: '#F7F7F9', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1E' }}>Absences</h1>
          <p style={{ fontSize: 13.5, color: '#71717a', marginTop: 4 }}>Track and manage leave requests</p>
        </div>
        <button onClick={load} title="Actualiser" style={{ width: 38, height: 38, border: '1px solid #E2E2E6', borderRadius: 10, background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a' }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#DC2626' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E2E6' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color, marginBottom: 4 }}>{loading ? '—' : value}</div>
            <div style={{ fontSize: 12.5, color: '#44444B', fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E2E6', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 1fr 0.5fr 1fr 1.2fr', padding: '13px 20px', borderBottom: '1px solid #E2E2E6', background: '#F7F7F9' }}>
          {['Collaborateur', 'Type', 'Début', 'Fin', 'Jours', 'Statut', 'Actions'].map(h => (
            <span key={h} style={{ fontSize: 11.5, fontWeight: 700, color: '#9A9AA2', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9A9AA2', fontSize: 13.5 }}>Loading absences…</div>
        ) : absences.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9A9AA2', fontSize: 13.5 }}>
            No absence records yet.
          </div>
        ) : (
          absences.map((a, i) => {
            const s = STATUS[a.status] || STATUS.pending
            const isUpdating = updating === a.id
            return (
              <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 1fr 0.5fr 1fr 1.2fr', padding: '13px 20px', alignItems: 'center', borderBottom: i < absences.length - 1 ? '1px solid #F2F2F4' : 'none', opacity: isUpdating ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #4F46E5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {(a.employee_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1A1A1E' }}>{a.employee_name || `Employee`}</span>
                </div>
                <span style={{ fontSize: 13, color: '#44444B' }}>{TYPE_LABEL[a.type] || a.type}</span>
                <span style={{ fontSize: 13, color: '#44444B' }}>{fmtDate(a.start_date)}</span>
                <span style={{ fontSize: 13, color: '#44444B' }}>{fmtDate(a.end_date)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E' }}>{a.duration_days ?? '—'}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 99, color: s.color, background: s.bg, width: 'fit-content' }}>
                  <s.Icon size={11} /> {s.label}
                </span>
                <div style={{ display: 'flex', gap: 5 }}>
                  {a.status === 'pending' ? (
                    <>
                      <button disabled={isUpdating} onClick={() => changeStatus(a.id, 'approved')} style={{ padding: '4px 10px', background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>Approve</button>
                      <button disabled={isUpdating} onClick={() => changeStatus(a.id, 'rejected')} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>Reject</button>
                    </>
                  ) : (
                    <button disabled={isUpdating} onClick={() => changeStatus(a.id, 'pending')} style={{ padding: '4px 10px', background: '#F7F7F9', color: '#44444B', border: '1px solid #E2E2E6', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>Reset</button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
