import { useEffect, useState } from 'react'
import { Search, RefreshCw, AlertCircle } from 'lucide-react'
import { employeesAPI } from '../services/api'

const STATUS_STYLE = {
  actif:     { label: 'Actif',   color: '#059669', bg: 'rgba(16,185,129,0.12)' },
  inactif:   { label: 'Inactif', color: '#DC2626', bg: 'rgba(239,68,68,0.12)'  },
  en_sortie: { label: 'En sortie',  color: '#B45309', bg: 'rgba(245,158,11,0.12)' },
}

function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function Avatar({ name }) {
  const initials = name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?'
  const hue = name ? (name.charCodeAt(0) * 37 + name.charCodeAt(1) * 17) % 360 : 200
  return (
    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `hsl(${hue},55%,50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [search, setSearch]       = useState('')

  async function load() {
    setLoading(true); setError(null)
    try { setEmployees(await employeesAPI.list()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const q = search.toLowerCase()
  const filtered = employees.filter(e =>
    e.full_name?.toLowerCase().includes(q) ||
    e.matricule?.toLowerCase().includes(q) ||
    e.contract_type?.toLowerCase().includes(q)
  )

  return (
    <div style={{ padding: '32px 36px', background: '#F7F7F9', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1E' }}>Collaborateurs</h1>
          <p style={{ fontSize: 13.5, color: '#71717a', marginTop: 4 }}>Manage your team members</p>
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

      {/* Stats row */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Collaborateurs', value: employees.length,                                   color: '#4F46E5' },
            { label: 'Actif',          value: employees.filter(e => e.status === 'actif').length, color: '#059669' },
            { label: 'CDI',             value: employees.filter(e => e.contract_type === 'CDI').length, color: '#B45309' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E2E6' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 12.5, color: '#44444B', fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#9A9AA2' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, matricule or contract type…" style={{ width: '100%', padding: '10px 16px 10px 38px', border: '1.5px solid #E2E2E6', borderRadius: 10, fontSize: 13.5, color: '#1A1A1E', background: '#FFFFFF', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 1fr 1fr', padding: '13px 20px', borderBottom: '1px solid #E2E2E6', background: '#F7F7F9' }}>
          {['Collaborateur', 'Matricule', 'Contrat', 'Statut', 'Arrivée'].map(h => (
            <span key={h} style={{ fontSize: 11.5, fontWeight: 700, color: '#9A9AA2', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9A9AA2', fontSize: 13.5 }}>Loading employees…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9A9AA2', fontSize: 13.5 }}>{search ? 'Aucun résultat pour cette recherche.' : 'Aucun collaborateur — exécutez le script de seed pour en ajouter.'}</div>
        ) : (
          filtered.map((emp, i) => {
            const s = STATUS_STYLE[emp.status] || { label: emp.status, color: '#44444B', bg: '#F2F2F4' }
            return (
              <div key={emp.id} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 1fr 1fr', padding: '13px 20px', alignItems: 'center', borderBottom: i < filtered.length - 1 ? '1px solid #F2F2F4' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar name={emp.full_name} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1A1A1E' }}>{emp.full_name}</span>
                </div>
                <span style={{ fontSize: 12.5, fontFamily: 'monospace', color: '#4F46E5', background: 'rgba(99,102,241,0.08)', padding: '2px 8px', borderRadius: 6, width: 'fit-content' }}>{emp.matricule}</span>
                <span style={{ fontSize: 13, color: '#44444B' }}>{emp.contract_type || '—'}</span>
                <span style={{ display: 'inline-flex', fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 99, color: s.color, background: s.bg, width: 'fit-content' }}>{s.label}</span>
                <span style={{ fontSize: 13, color: '#71717a' }}>{fmt(emp.hire_date)}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
