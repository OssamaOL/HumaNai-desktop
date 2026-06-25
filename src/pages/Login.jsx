import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Sparkles, ShieldCheck, BarChart3, MessageSquareText, ArrowRight, UserPlus, LogIn } from 'lucide-react'

const ROLES = [
  { value: 'admin',         label: 'Admin',          color: '#DC2626' },
  { value: 'rh',            label: 'RH',              color: '#4F46E5' },
  { value: 'manager',       label: 'Manager',         color: '#B45309' },
  { value: 'collaborateur', label: 'Collaborateur',   color: '#059669' },
  { value: 'direction',     label: 'Direction',       color: '#2563EB' },
]

const TEST_ACCOUNTS = [
  { email: 'admin@humanai.com',   password: 'Admin2026!',   role: 'Admin',   color: '#DC2626' },
  { email: 'rh@humanai.com',      password: 'RH2026!',      role: 'RH',      color: '#4F46E5' },
  { email: 'manager@humanai.com', password: 'Manager2026!', role: 'Manager', color: '#B45309' },
]

const features = [
  { icon: MessageSquareText, text: 'Assistant IA conversationnel pour vos collaborateurs' },
  { icon: BarChart3,         text: 'Tableaux de bord prédictifs en temps réel' },
  { icon: ShieldCheck,       text: 'Sécurité renforcée — RBAC & traçabilité complète' },
]

const inputStyle = {
  width: '100%', padding: '12px 14px',
  border: '1.5px solid #E2E2E6', borderRadius: 11,
  fontSize: 13.5, color: '#1A1A1E', outline: 'none',
  fontFamily: 'inherit', background: '#FFFFFF', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

export default function Login() {
  const { login, loading, error, setError } = useAuth()
  const [tab, setTab]               = useState('login')  // 'login' | 'signup'

  // Login state
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPwd, setShowPwd]       = useState(false)

  // Signup state
  const [sgEmail, setSgEmail]       = useState('')
  const [sgPassword, setSgPassword] = useState('')
  const [sgName, setSgName]         = useState('')
  const [sgRole, setSgRole]         = useState('rh')
  const [sgShowPwd, setSgShowPwd]   = useState(false)
  const [sgLoading, setSgLoading]   = useState(false)
  const [sgSuccess, setSgSuccess]   = useState(false)
  const [sgError, setSgError]       = useState(null)

  function switchTab(t) {
    setTab(t)
    setError?.(null)
    setSgError(null)
    setSgSuccess(false)
  }

  async function handleLogin(e) {
    e.preventDefault()
    await login(email, password)
  }

  async function handleSignup(e) {
    e.preventDefault()
    setSgLoading(true); setSgError(null); setSgSuccess(false)
    try {
      const { authAPI } = await import('../services/api')
      await authAPI.signup(sgEmail, sgPassword, sgName, sgRole)
      setSgSuccess(true)
      // Auto-fill login form and switch tab
      setEmail(sgEmail)
      setPassword(sgPassword)
      setTimeout(() => switchTab('login'), 1800)
    } catch (err) {
      setSgError(err.message)
    } finally { setSgLoading(false) }
  }

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', background: '#F7F7F9' }}>

      {/* LEFT — branding panel */}
      <div style={{
        flex: '0 0 46%',
        background: 'radial-gradient(circle at 20% 20%, #EEF0FF 0%, #F7F7F9 55%), #F7F7F9',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        padding: '56px 52px', color: '#1A1A1E',
        borderRight: '1px solid #E2E2E6',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(20,20,30,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(20,20,30,0.035) 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(ellipse at top left, black 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', top: -100, right: -120, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -140, left: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(129,140,248,0.15), transparent 70%)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #4F46E5, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(99,102,241,0.5)' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>H</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.3px' }}>HumaNai</span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1, maxWidth: 380 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(99,102,241,0.12)', borderRadius: 99, padding: '5px 12px', marginBottom: 22, width: 'fit-content', border: '1px solid rgba(99,102,241,0.3)' }}>
            <Sparkles size={12} style={{ color: '#4F46E5' }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#4F46E5' }}>Plateforme IA RH</span>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.8px', color: '#1A1A1E' }}>
            Automatisation, pilotage prédictif et accompagnement RH
          </h1>
          <p style={{ fontSize: 14.5, color: '#71717a', lineHeight: 1.6, marginBottom: 36 }}>
            Une solution centralisée pour vos équipes RH, managers et collaborateurs.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {features.map(({ icon: Icon, text }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E2E2E6' }}>
                  <Icon size={15} style={{ color: '#4F46E5' }} />
                </div>
                <span style={{ fontSize: 13.5, color: '#44444B', fontWeight: 500 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 11.5, color: '#9A9AA2', position: 'relative', zIndex: 1 }}>YDAYS 2026 · Ynov Campus</p>
      </div>

      {/* RIGHT — form panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
        <div style={{ width: 400 }}>

          {/* Tab switcher */}
          <div style={{ display: 'flex', background: '#F7F7F9', borderRadius: 12, padding: 4, marginBottom: 28, border: '1px solid #E2E2E6' }}>
            {[
              { id: 'login',  label: 'Connexion',    icon: LogIn },
              { id: 'signup', label: 'Créer un compte', icon: UserPlus },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => switchTab(id)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: tab === id ? 700 : 500,
                background: tab === id ? '#FFFFFF' : 'transparent',
                color: tab === id ? '#1A1A1E' : '#9A9AA2',
                boxShadow: tab === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>

          {/* ── LOGIN ── */}
          {tab === 'login' && (
            <>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1E', marginBottom: 6, letterSpacing: '-0.5px' }}>Bienvenue 👋</h2>
              <p style={{ fontSize: 13.5, color: '#71717a', marginBottom: 24 }}>Connectez-vous à votre espace RH</p>

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#44444B', display: 'block', marginBottom: 6 }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" required style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#4F46E5'} onBlur={e => e.target.style.borderColor = '#E2E2E6'} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#44444B', display: 'block', marginBottom: 6 }}>Mot de passe</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={e => e.target.style.borderColor = '#4F46E5'} onBlur={e => e.target.style.borderColor = '#E2E2E6'} />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', display: 'flex' }}>
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', fontSize: 12.5, color: '#DC2626', fontWeight: 500 }}>{error}</div>}

                <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? '#3730a3' : 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                  {loading ? 'Connexion...' : <>Se connecter <ArrowRight size={15} /></>}
                </button>
              </form>

              {/* Quick fill accounts */}
              <div style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, height: 1, background: '#E2E2E6' }} />
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#9A9AA2', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Comptes de test</span>
                  <div style={{ flex: 1, height: 1, background: '#E2E2E6' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {TEST_ACCOUNTS.map(acc => (
                    <button key={acc.email} onClick={() => { setEmail(acc.email); setPassword(acc.password) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 13px', borderRadius: 9, background: '#FFFFFF', border: '1px solid #E2E2E6', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = acc.color}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E2E6'}>
                      <span style={{ fontSize: 12, color: '#44444B', fontFamily: 'monospace' }}>{acc.email}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 99, color: '#fff', background: acc.color }}>{acc.role}</span>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: '#9A9AA2', marginTop: 8, textAlign: 'center' }}>Cliquez sur un compte pour le saisir automatiquement</p>
              </div>
            </>
          )}

          {/* ── SIGNUP ── */}
          {tab === 'signup' && (
            <>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1A1A1E', marginBottom: 6, letterSpacing: '-0.5px' }}>Créer un compte</h2>
              <p style={{ fontSize: 13.5, color: '#71717a', marginBottom: 24 }}>Remplissez les informations ci-dessous</p>

              {sgSuccess ? (
                <div style={{ padding: '20px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#059669', marginBottom: 4 }}>Compte créé avec succès !</p>
                  <p style={{ fontSize: 12.5, color: '#71717a' }}>Redirection vers la connexion…</p>
                </div>
              ) : (
                <form onSubmit={handleSignup}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#44444B', display: 'block', marginBottom: 6 }}>Nom complet</label>
                    <input value={sgName} onChange={e => setSgName(e.target.value)} placeholder="Prénom Nom" required style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#4F46E5'} onBlur={e => e.target.style.borderColor = '#E2E2E6'} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#44444B', display: 'block', marginBottom: 6 }}>Email</label>
                    <input type="email" value={sgEmail} onChange={e => setSgEmail(e.target.value)} placeholder="votre@email.com" required style={inputStyle}
                      onFocus={e => e.target.style.borderColor = '#4F46E5'} onBlur={e => e.target.style.borderColor = '#E2E2E6'} />
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#44444B', display: 'block', marginBottom: 6 }}>Mot de passe</label>
                    <div style={{ position: 'relative' }}>
                      <input type={sgShowPwd ? 'text' : 'password'} value={sgPassword} onChange={e => setSgPassword(e.target.value)} placeholder="Min. 8 caractères" required style={{ ...inputStyle, paddingRight: 44 }}
                        onFocus={e => e.target.style.borderColor = '#4F46E5'} onBlur={e => e.target.style.borderColor = '#E2E2E6'} />
                      <button type="button" onClick={() => setSgShowPwd(!sgShowPwd)} style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', display: 'flex' }}>
                        {sgShowPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#44444B', display: 'block', marginBottom: 6 }}>Rôle</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {ROLES.map(r => (
                        <button key={r.value} type="button" onClick={() => setSgRole(r.value)} style={{
                          padding: '6px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          border: sgRole === r.value ? `1.5px solid ${r.color}` : '1.5px solid #E2E2E6',
                          background: sgRole === r.value ? r.color : '#F7F7F9',
                          color: sgRole === r.value ? '#fff' : '#71717a',
                          transition: 'all 0.12s',
                        }}>{r.label}</button>
                      ))}
                    </div>
                  </div>

                  {sgError && <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', fontSize: 12.5, color: '#DC2626', fontWeight: 500 }}>{sgError}</div>}

                  <button type="submit" disabled={sgLoading} style={{ width: '100%', padding: '13px', background: sgLoading ? '#3730a3' : 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: sgLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                    {sgLoading ? 'Création...' : <>Créer le compte <ArrowRight size={15} /></>}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
