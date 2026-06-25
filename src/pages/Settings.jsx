import { useState, useEffect } from 'react'
import { User, Bell, Shield, Database, RefreshCw, AlertTriangle, Eye, Save, CheckCircle, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { adminAPI, systemAPI } from '../services/api'

function Toggle({ defaultOn = false }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div onClick={() => setOn(!on)} style={{ width: 40, height: 22, borderRadius: 99, background: on ? '#4F46E5' : '#E2E2E6', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </div>
  )
}

export default function Settings() {
  const { user, logout, updateUser } = useAuth()
  const isAdmin = user?.role === 'admin'

  const sections = [
    { id: 'profile',    icon: User,     label: 'Mon profil' },
    { id: 'notifs',     icon: Bell,     label: 'Notifications' },
    ...(isAdmin ? [{ id: 'security', icon: Shield, label: 'Sécurité' }] : []),
    { id: 'system',     icon: Database, label: 'Système' },
  ]

  const [active, setActive]               = useState('profile')
  const [fullName, setFullName]           = useState(user?.full_name || '')
  const [saving, setSaving]               = useState(false)
  const [saveStatus, setSaveStatus]       = useState(null) // 'ok' | 'error' | null
  const [securityEvents, setSecurityEvents] = useState([])
  const [auditLogs, setAuditLogs]         = useState([])
  const [loadingSec, setLoadingSec]       = useState(false)
  const [healthStatus, setHealthStatus]   = useState(null)

  useEffect(() => { setFullName(user?.full_name || '') }, [user])
  useEffect(() => {
    if (active === 'security') loadSecurity()
    if (active === 'system')   loadHealth()
  }, [active])

  async function loadSecurity() {
    setLoadingSec(true)
    try {
      const [events, logs] = await Promise.all([adminAPI.getSecurityEvents(), adminAPI.getAuditLogs()])
      setSecurityEvents(events || [])
      setAuditLogs(logs || [])
    } catch {} finally { setLoadingSec(false) }
  }

  async function loadHealth() {
    try { setHealthStatus(await systemAPI.health()) }
    catch { setHealthStatus({ status: 'error' }) }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!fullName.trim()) return
    setSaving(true); setSaveStatus(null)
    try {
      await updateUser(fullName.trim())
      setSaveStatus('ok')
      setTimeout(() => setSaveStatus(null), 3000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 3000)
    } finally { setSaving(false) }
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #E2E2E6',
    borderRadius: 10, fontSize: 13.5, color: '#1A1A1E', outline: 'none',
    fontFamily: 'inherit', background: '#FFFFFF', boxSizing: 'border-box',
  }

  const initials = (user?.full_name || 'U').split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase()
  const hue = (user?.full_name || '').charCodeAt(0) % 360

  return (
    <div style={{ display: 'flex', height: '100%', background: '#F7F7F9' }}>

      {/* Left nav */}
      <div style={{ width: 200, borderRight: '1px solid #F2F2F4', background: '#FFFFFF', padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#9A9AA2', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px', marginBottom: 8 }}>Paramètres</p>
        {sections.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActive(id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
            borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13.5,
            fontWeight: active === id ? 600 : 500,
            color: active === id ? '#4F46E5' : '#71717a',
            background: active === id ? 'rgba(99,102,241,0.12)' : 'transparent',
            textAlign: 'left', width: '100%', fontFamily: 'inherit',
          }}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>

        {/* ── PROFIL ── */}
        {active === 'profile' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1E', marginBottom: 4 }}>Mon profil</h2>
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 28 }}>Informations de votre compte</p>

            <form onSubmit={handleSave} style={{ background: '#FFFFFF', borderRadius: 16, padding: '28px', border: '1px solid #E2E2E6', maxWidth: 520 }}>
              {/* Avatar row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, padding: 14, background: 'rgba(99,102,241,0.06)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.15)' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: `hsl(${hue},55%,48%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {initials}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1E' }}>{user?.full_name}</p>
                  <p style={{ fontSize: 13, color: '#4F46E5', fontWeight: 500 }}>{user?.email}</p>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, background: '#4F46E5', color: '#fff', textTransform: 'capitalize', marginTop: 4, display: 'inline-block' }}>{user?.role}</span>
                </div>
              </div>

              {/* Editable name */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#44444B', display: 'block', marginBottom: 6 }}>Nom complet</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} placeholder="Votre nom complet" />
              </div>

              {/* Read-only fields */}
              {[{ label: 'E-mail', value: user?.email || '' }, { label: 'Rôle', value: user?.role || '' }].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#44444B', display: 'block', marginBottom: 6 }}>{label}</label>
                  <input value={value} readOnly style={{ ...inputStyle, background: '#F7F7F9', color: '#71717a', cursor: 'not-allowed' }} />
                </div>
              ))}

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="submit" disabled={saving || !fullName.trim()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
                  <Save size={14} />{saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button type="button" onClick={logout} style={{ padding: '10px 22px', background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Déconnexion
                </button>
                {saveStatus === 'ok' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#059669', fontWeight: 600 }}>
                    <CheckCircle size={14} /> Nom mis à jour avec succès
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>Erreur — réessayez</span>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {active === 'notifs' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1E', marginBottom: 4 }}>Notifications</h2>
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 28 }}>Choisissez ce dont vous souhaitez être notifié</p>
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '8px 24px', border: '1px solid #E2E2E6', maxWidth: 520 }}>
              {[
                { label: 'Nouvelles demandes de congé',           sub: 'Quand un collaborateur soumet une demande',              on: true  },
                { label: 'Alertes d\'expiration de contrat',      sub: 'Rappel 30 jours avant l\'expiration d\'un contrat',      on: true  },
                { label: 'Étapes d\'intégration',                 sub: 'Progression des plans d\'intégration des nouvelles recrues',on: false },
                { label: 'Mises à jour du score d\'engagement',   sub: 'Rapport hebdomadaire du score d\'engagement',            on: true  },
                { label: 'Alertes de sécurité',                   sub: 'Tentatives d\'accès non autorisées',                     on: true  },
              ].map(({ label, sub, on }, i, arr) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: i < arr.length - 1 ? '1px solid #F2F2F4' : 'none', gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: '#232326', marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: 12, color: '#71717a' }}>{sub}</p>
                  </div>
                  <Toggle defaultOn={on} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECURITE (admin only) ── */}
        {active === 'security' && isAdmin && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1E', marginBottom: 4 }}>Sécurité</h2>
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 20 }}>Événements de sécurité IA et journal d'audit</p>
            <button onClick={loadSecurity} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16, fontFamily: 'inherit' }}>
              <RefreshCw size={13} /> Actualiser
            </button>
            {loadingSec && <p style={{ fontSize: 13, color: '#71717a' }}>Chargement…</p>}
            {!loadingSec && securityEvents.length === 0 && auditLogs.length === 0 && (
              <div style={{ padding: 20, background: '#FFFFFF', borderRadius: 12, border: '1px solid #E2E2E6', color: '#71717a', fontSize: 13.5, textAlign: 'center' }}>Aucun événement de sécurité trouvé</div>
            )}
            {securityEvents.length > 0 && (
              <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '12px 18px', background: '#F7F7F9', borderBottom: '1px solid #E2E2E6' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#44444B' }}>Événements de sécurité ({securityEvents.length})</span>
                </div>
                {securityEvents.slice(0,10).map((ev, i) => (
                  <div key={ev.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < 9 ? '1px solid #F2F2F4' : 'none' }}>
                    <AlertTriangle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#232326' }}>{ev.event_type}</p>
                      <p style={{ fontSize: 11.5, color: '#71717a' }}>{ev.created_at?.slice(0,19)?.replace('T',' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {auditLogs.length > 0 && (
              <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', background: '#F7F7F9', borderBottom: '1px solid #E2E2E6' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#44444B' }}>Journal d'audit ({auditLogs.length})</span>
                </div>
                {auditLogs.slice(0,8).map((log, i) => (
                  <div key={log.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #F2F2F4' }}>
                    <Eye size={14} style={{ color: '#4F46E5', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#232326' }}>{log.action} — {log.entity_type}</p>
                      <p style={{ fontSize: 11.5, color: '#71717a' }}>{log.timestamp?.slice(0,19)?.replace('T',' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SYSTÈME ── */}
        {active === 'system' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1E', marginBottom: 4 }}>Système</h2>
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 20 }}>État du backend et informations de connexion</p>
            <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px', border: '1px solid #E2E2E6', maxWidth: 460 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#232326' }}>État du backend</span>
                <button onClick={loadHealth} style={{ padding: '6px 14px', background: '#F7F7F9', border: '1px solid #E2E2E6', borderRadius: 8, fontSize: 12.5, cursor: 'pointer', fontWeight: 600, color: '#44444B', fontFamily: 'inherit' }}>Vérifier</button>
              </div>
              {healthStatus ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: healthStatus.status === 'healthy' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: healthStatus.status === 'healthy' ? '#059669' : '#DC2626' }} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: healthStatus.status === 'healthy' ? '#059669' : '#DC2626' }}>
                    {healthStatus.status === 'healthy' ? 'Backend en ligne' : 'Backend hors ligne'}
                  </span>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#71717a' }}>Cliquez sur « Vérifier » pour tester la connexion</p>
              )}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F2F2F4' }}>
                {[['Version API', '0.1.0'], ['Base de données', 'PostgreSQL 16'], ['Auth', 'JWT · argon2id · RBAC']].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                    <span style={{ color: '#71717a' }}>{k}</span>
                    <span style={{ color: '#232326', fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
