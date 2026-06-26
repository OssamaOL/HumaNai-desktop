import { useEffect, useState } from 'react'
import { RefreshCw, AlertTriangle, TrendingDown, Star, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react'
import { engagementAPI } from '../services/api'

const RISK_META = {
  high:   { label: 'Risque élevé',   color: '#DC2626', bg: 'rgba(239,68,68,0.12)'   },
  medium: { label: 'Risque moyen',   color: '#B45309', bg: 'rgba(245,158,11,0.12)'  },
  low:    { label: 'Risque faible',  color: '#059669', bg: 'rgba(16,185,129,0.12)'  },
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Engagement() {
  const [tab, setTab]               = useState('signals')
  const [signals, setSignals]       = useState([])
  const [reviews, setReviews]       = useState([])
  const [surveys, setSurveys]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [expanded, setExpanded]     = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [s, r, sv] = await Promise.all([
        engagementAPI.signals(),
        engagementAPI.reviews(),
        engagementAPI.surveys(),
      ])
      setSignals(Array.isArray(s) ? s : [])
      setReviews(Array.isArray(r) ? r : [])
      setSurveys(Array.isArray(sv) ? sv : [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const highRisk   = signals.filter(s => s.risk_level === 'high').length
  const medRisk    = signals.filter(s => s.risk_level === 'medium').length
  const avgRating  = reviews.length ? (reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length).toFixed(1) : '—'

  const TABS = [
    { id: 'signals', label: 'Signaux désengagement', count: signals.length },
    { id: 'reviews', label: 'Entretiens annuels',    count: reviews.length },
    { id: 'surveys', label: 'Surveys',               count: surveys.length },
  ]

  return (
    <div style={{ padding: '32px 36px', background: '#F7F7F9', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1E' }}>Engagement</h1>
          <p style={{ fontSize: 13.5, color: '#71717a', marginTop: 4 }}>Surveys, entretiens annuels et signaux de désengagement</p>
        </div>
        <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Signaux total',    value: signals.length, color: '#4F46E5', Icon: TrendingDown },
          { label: 'Risque élevé',     value: highRisk,       color: '#DC2626', Icon: AlertTriangle },
          { label: 'Risque moyen',     value: medRisk,        color: '#B45309', Icon: AlertTriangle },
          { label: 'Note moy. entretien', value: avgRating,  color: '#059669', Icon: Star },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px', border: '1px solid #E2E2E6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 12.5, color: '#44444B', fontWeight: 600 }}>{label}</p>
              <Icon size={16} style={{ color }} />
            </div>
            <p style={{ fontSize: 28, fontWeight: 800, color: '#1A1A1E' }}>{loading ? '…' : value}</p>
          </div>
        ))}
      </div>

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
            <span style={{ background: tab === t.id ? 'rgba(255,255,255,0.25)' : '#F2F2F4', color: tab === t.id ? '#fff' : '#44444B', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Tab: Disengagement signals */}
      {tab === 'signals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? <p style={{ color: '#71717a', fontSize: 13.5 }}>Chargement…</p>
          : signals.length === 0 ? (
            <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', padding: 40, textAlign: 'center', color: '#71717a', fontSize: 13.5 }}>
              Aucun signal de désengagement détecté.
            </div>
          ) : signals.map(s => {
            const meta = RISK_META[s.risk_level] || RISK_META.low
            const isOpen = expanded === s.id
            const signalKeys = s.signals ? Object.keys(s.signals).filter(k => s.signals[k]) : []
            return (
              <div key={s.id} style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', overflow: 'hidden' }}>
                <div onClick={() => setExpanded(isOpen ? null : s.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={20} style={{ color: meta.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E' }}>Employé #{s.employee_id?.slice(0, 8)}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 99 }}>{meta.label}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: '#71717a' }}>Score de risque : <strong style={{ color: meta.color }}>{s.risk_score?.toFixed(0)}%</strong> · Calculé le {fmtDate(s.computed_at)}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, height: 6, background: '#E2E2E6', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.risk_score || 0}%`, background: meta.color, borderRadius: 99 }} />
                    </div>
                    {isOpen ? <ChevronUp size={16} color="#71717a" /> : <ChevronDown size={16} color="#71717a" />}
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding: '0 20px 16px 78px', borderTop: '1px solid #F2F2F4' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#44444B', marginBottom: 8, marginTop: 12 }}>Signaux détectés</p>
                    {signalKeys.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {signalKeys.map(k => (
                          <span key={k} style={{ fontSize: 11.5, background: '#F2F2F4', color: '#44444B', padding: '3px 10px', borderRadius: 99, fontWeight: 500 }}>
                            {k.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    ) : <p style={{ fontSize: 12.5, color: '#9A9AA2' }}>Aucun signal spécifique.</p>}
                    {s.action_plan && Object.keys(s.action_plan).length > 0 && (
                      <>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#44444B', marginBottom: 6, marginTop: 12 }}>Plan d'action</p>
                        <p style={{ fontSize: 12.5, color: '#44444B' }}>{JSON.stringify(s.action_plan)}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Annual Reviews */}
      {tab === 'reviews' && (
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E2E6', overflow: 'hidden' }}>
          {loading ? <p style={{ color: '#71717a', fontSize: 13.5, padding: 20 }}>Chargement…</p>
          : reviews.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#71717a', fontSize: 13.5 }}>Aucun entretien annuel enregistré.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E2E6' }}>
                  {['Employé', 'Note /10', 'Charge travail', 'Date', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reviews.map((r, i) => {
                  const ratingColor = r.rating >= 8 ? '#059669' : r.rating >= 6 ? '#B45309' : '#DC2626'
                  return (
                    <tr key={r.id} style={{ borderBottom: i < reviews.length - 1 ? '1px solid #F2F2F4' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#1A1A1E', fontWeight: 500 }}>#{r.employee_id?.slice(0, 8)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: ratingColor }}>{r.rating ?? '—'}</span>
                        <div style={{ marginTop: 4, width: 60, height: 4, background: '#E2E2E6', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(r.rating || 0) * 10}%`, background: ratingColor, borderRadius: 99 }} />
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#44444B' }}>{r.workload_score ?? '—'}/10</td>
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#71717a' }}>{fmtDate(r.review_date)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#71717a', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Surveys */}
      {tab === 'surveys' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
          {loading ? <p style={{ color: '#71717a', fontSize: 13.5 }}>Chargement…</p>
          : surveys.length === 0 ? (
            <div style={{ gridColumn: '1/-1', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', padding: 40, textAlign: 'center', color: '#71717a', fontSize: 13.5 }}>
              Aucun survey créé.
            </div>
          ) : surveys.map(s => (
            <div key={s.id} style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ClipboardList size={18} style={{ color: '#4F46E5' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1E', marginBottom: 4 }}>{s.title}</p>
                  <p style={{ fontSize: 12.5, color: '#71717a' }}>Créé le {fmtDate(s.created_at)}</p>
                  {s.is_anonymous && (
                    <span style={{ marginTop: 8, display: 'inline-block', fontSize: 11, fontWeight: 600, color: '#4F46E5', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 99 }}>Anonyme</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
