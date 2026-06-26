import { useEffect, useState } from 'react'
import { RefreshCw, Shield, AlertTriangle, MessageSquare, TrendingUp } from 'lucide-react'
import { supervisionAPI } from '../services/api'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const ROLE_COLORS = {
  admin:         { color: '#DC2626', bg: 'rgba(239,68,68,0.1)'   },
  rh:            { color: '#4F46E5', bg: 'rgba(99,102,241,0.1)'  },
  manager:       { color: '#059669', bg: 'rgba(16,185,129,0.1)'  },
  collaborateur: { color: '#B45309', bg: 'rgba(245,158,11,0.1)'  },
  direction:     { color: '#9333EA', bg: 'rgba(168,85,247,0.1)'  },
}

const SEV_META = {
  critique: { color: '#DC2626', bg: 'rgba(239,68,68,0.1)',  label: 'Critique' },
  anomalie: { color: '#B45309', bg: 'rgba(245,158,11,0.1)', label: 'Anomalie' },
  info:     { color: '#4F46E5', bg: 'rgba(99,102,241,0.1)', label: 'Info'     },
}

export default function Supervision() {
  const [tab, setTab]           = useState('interactions')
  const [stats, setStats]       = useState(null)
  const [risk, setRisk]         = useState(null)
  const [interactions, setInteractions] = useState([])
  const [injections, setInjections]     = useState([])
  const [unauthorized, setUnauthorized] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [st, rs, inter, inj, unauth] = await Promise.all([
        supervisionAPI.stats(),
        supervisionAPI.riskScore(),
        supervisionAPI.interactions(),
        supervisionAPI.promptInjections(),
        supervisionAPI.unauthorizedAttempts(),
      ])
      setStats(st)
      setRisk(rs)
      setInteractions(Array.isArray(inter) ? inter : [])
      setInjections(Array.isArray(inj) ? inj : [])
      setUnauthorized(Array.isArray(unauth) ? unauth : [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const riskScore   = risk?.risk_score ?? 0
  const riskColor   = riskScore >= 70 ? '#DC2626' : riskScore >= 40 ? '#B45309' : '#059669'
  const riskLabel   = riskScore >= 70 ? 'Élevé' : riskScore >= 40 ? 'Modéré' : 'Faible'

  const TABS = [
    { id: 'interactions', label: 'Interactions IA',      count: interactions.length   },
    { id: 'injections',   label: 'Injections de prompt', count: injections.length     },
    { id: 'unauthorized', label: 'Accès non autorisés',  count: unauthorized.length   },
  ]

  return (
    <div style={{ padding: '32px 36px', background: '#F7F7F9', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1E' }}>Supervision IA</h1>
          <p style={{ fontSize: 13.5, color: '#71717a', marginTop: 4 }}>Monitoring des interactions et sécurité de l'assistant</p>
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px', border: '1px solid #E2E2E6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 12.5, color: '#44444B', fontWeight: 600 }}>Total interactions</p>
            <MessageSquare size={16} style={{ color: '#4F46E5' }} />
          </div>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#1A1A1E' }}>{loading ? '…' : stats?.total_interactions ?? 0}</p>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px', border: '1px solid #E2E2E6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 12.5, color: '#44444B', fontWeight: 600 }}>Injections détectées</p>
            <AlertTriangle size={16} style={{ color: '#DC2626' }} />
          </div>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#DC2626' }}>{loading ? '…' : injections.length}</p>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px', border: '1px solid #E2E2E6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 12.5, color: '#44444B', fontWeight: 600 }}>Accès refusés</p>
            <Shield size={16} style={{ color: '#B45309' }} />
          </div>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#B45309' }}>{loading ? '…' : unauthorized.length}</p>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px', border: '1px solid #E2E2E6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <p style={{ fontSize: 12.5, color: '#44444B', fontWeight: 600 }}>Score de risque</p>
            <TrendingUp size={16} style={{ color: riskColor }} />
          </div>
          <p style={{ fontSize: 28, fontWeight: 800, color: riskColor }}>{loading ? '…' : `${riskScore}%`}</p>
          <span style={{ fontSize: 11, fontWeight: 700, color: riskColor, background: riskColor + '18', padding: '2px 8px', borderRadius: 99 }}>{riskLabel}</span>
          <div style={{ marginTop: 8, height: 4, background: '#E2E2E6', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${riskScore}%`, background: riskColor, borderRadius: 99 }} />
          </div>
        </div>
      </div>

      {/* Usage by role */}
      {stats?.by_role && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', padding: '20px', marginBottom: 20 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1A1E', marginBottom: 16 }}>Utilisation par rôle</p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {Object.entries(stats.by_role).map(([role, count]) => {
              const meta = ROLE_COLORS[role] || { color: '#44444B', bg: '#F2F2F4' }
              const pct  = stats.total_interactions > 0 ? Math.round((count / stats.total_interactions) * 100) : 0
              return (
                <div key={role} style={{ flex: '1 1 120px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 99 }}>{role}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1E' }}>{count}</span>
                  </div>
                  <div style={{ height: 5, background: '#E2E2E6', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: meta.color, borderRadius: 99 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#FFFFFF', borderRadius: 12, padding: 4, border: '1px solid #E2E2E6', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 16px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t.id ? '#6366f1' : 'transparent', color: tab === t.id ? '#fff' : '#71717a', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t.label}
            {t.count > 0 && <span style={{ background: tab === t.id ? 'rgba(255,255,255,0.25)' : '#F2F2F4', color: tab === t.id ? '#fff' : '#44444B', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab: Interactions */}
      {tab === 'interactions' && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', overflow: 'hidden' }}>
          {loading ? <p style={{ padding: 20, color: '#71717a', fontSize: 13.5 }}>Chargement…</p>
          : interactions.length === 0 ? <p style={{ padding: 40, textAlign: 'center', color: '#71717a', fontSize: 13.5 }}>Aucune interaction enregistrée.</p>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E2E6' }}>
                  {['Session', 'Rôle', 'Résumé', 'Date'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {interactions.map((item, i) => {
                  const roleMeta = ROLE_COLORS[item.role] || { color: '#44444B', bg: '#F2F2F4' }
                  return (
                    <tr key={item.id} style={{ borderBottom: i < interactions.length - 1 ? '1px solid #F2F2F4' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#71717a', fontFamily: 'monospace' }}>#{item.session_id?.slice(0, 8)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: roleMeta.color, background: roleMeta.bg, padding: '2px 8px', borderRadius: 99 }}>{item.role}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#44444B', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.response_summary || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#71717a', whiteSpace: 'nowrap' }}>{fmtDate(item.timestamp)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Prompt injections */}
      {tab === 'injections' && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', overflow: 'hidden' }}>
          {loading ? <p style={{ padding: 20, color: '#71717a', fontSize: 13.5 }}>Chargement…</p>
          : injections.length === 0 ? <p style={{ padding: 40, textAlign: 'center', color: '#059669', fontSize: 13.5 }}>✓ Aucune tentative d'injection détectée.</p>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E2E6' }}>
                  {['ID', 'Sévérité', 'Date'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {injections.map((ev, i) => {
                  const sev = SEV_META[ev.severity] || SEV_META.info
                  return (
                    <tr key={ev.id} style={{ borderBottom: i < injections.length - 1 ? '1px solid #F2F2F4' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#71717a', fontFamily: 'monospace' }}>#{ev.id?.slice(0, 8)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: sev.color, background: sev.bg, padding: '3px 10px', borderRadius: 99 }}>{sev.label}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#71717a' }}>{fmtDate(ev.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Unauthorized */}
      {tab === 'unauthorized' && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', overflow: 'hidden' }}>
          {loading ? <p style={{ padding: 20, color: '#71717a', fontSize: 13.5 }}>Chargement…</p>
          : unauthorized.length === 0 ? <p style={{ padding: 40, textAlign: 'center', color: '#059669', fontSize: 13.5 }}>✓ Aucun accès non autorisé détecté.</p>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E2E6' }}>
                  {['ID', 'Sévérité', 'Date'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unauthorized.map((ev, i) => {
                  const sev = SEV_META[ev.severity] || SEV_META.info
                  return (
                    <tr key={ev.id} style={{ borderBottom: i < unauthorized.length - 1 ? '1px solid #F2F2F4' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#71717a', fontFamily: 'monospace' }}>#{ev.id?.slice(0, 8)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: sev.color, background: sev.bg, padding: '3px 10px', borderRadius: 99 }}>{sev.label}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#71717a' }}>{fmtDate(ev.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
