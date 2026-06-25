import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles } from 'lucide-react'
import { assistantAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

const SUGGESTIONS_BY_ROLE = {
  admin: [
    'Combien de tentatives de connexion échouées cette semaine ?',
    'Quel est l\'état de santé du système ?',
    'Quels utilisateurs ont le rôle admin ?',
    'Combien d\'interactions IA ont eu lieu ce mois-ci ?',
  ],
  rh: [
    'Quel est le taux de turnover ce trimestre ?',
    'Combien d\'onboardings sont en cours ?',
    'Qui a un contrat qui expire ce mois-ci ?',
    'Quelles alertes RH sont non résolues ?',
  ],
  manager: [
    'Quel est le taux d\'absentéisme de mon équipe ?',
    'Qui est en congé cette semaine ?',
    'Comment initier un entretien annuel ?',
    'Quels collaborateurs ont des absences fréquentes ?',
  ],
  direction: [
    'Quelle est l\'évolution de la masse salariale ?',
    'Quel département a le plus fort taux de turnover ?',
    'Quel est le coût moyen par embauche ?',
    'Quels sont les indicateurs RH clés du trimestre ?',
  ],
  collaborateur: [
    'Combien de jours de congé me restent ?',
    'Comment soumettre une demande d\'absence ?',
    'Quelle est la politique de télétravail ?',
    'Comment accéder à ma fiche de paie ?',
  ],
  qvt: [
    'Quels collaborateurs présentent un risque de burnout ?',
    'Quel est le score d\'engagement moyen ?',
    'Quelles actions QVT sont en cours ?',
    'Comment signaler un risque psychosocial ?',
  ],
}

const firstMsg = { role: 'assistant', text: 'Bonjour ! Je suis HumaNai, votre assistant IA RH. Comment puis-je vous aider ?' }

export default function Assistant() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([firstMsg])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const role = user?.role || 'collaborateur'
  const suggestions = SUGGESTIONS_BY_ROLE[role] || SUGGESTIONS_BY_ROLE.collaborateur

  async function sendMessage(text) {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)
    try {
      const data = await assistantAPI.chat(msg, sessionId)
      setSessionId(data.session_id)
      setMessages(prev => [...prev, { role: 'assistant', text: data.response, sources: data.sources || [] }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: "Désolé, une erreur s'est produite. " + err.message, isError: true }])
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F7F7F9' }}>

      {/* Header */}
      <div style={{ padding: '20px 36px 16px', borderBottom: '1px solid #F2F2F4', background: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #4F46E5, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(99,102,241,0.4)' }}>
            <Sparkles size={18} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1A1A1E' }}>Assistant IA</h1>
            <p style={{ fontSize: 12, color: '#71717a' }}>Powered by HumaNai RAG</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: m.role === 'assistant' ? 'linear-gradient(135deg, #4F46E5, #6366f1)' : '#E2E2E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {m.role === 'assistant' ? <Bot size={16} style={{ color: '#fff' }} /> : <User size={16} style={{ color: '#44444B' }} />}
            </div>
            <div style={{ maxWidth: '65%' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: m.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                background: m.role === 'user' ? '#6366f1' : m.isError ? 'rgba(239,68,68,0.1)' : '#FFFFFF',
                color: m.role === 'user' ? '#fff' : m.isError ? '#DC2626' : '#232326',
                fontSize: 13.5, lineHeight: 1.6,
                border: m.role === 'assistant' ? `1px solid ${m.isError ? 'rgba(239,68,68,0.3)' : '#E2E2E6'}` : 'none',
                whiteSpace: 'pre-wrap',
              }}>{m.text}</div>
              {m.sources && m.sources.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {m.sources.map((s, j) => <span key={j} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 99, background: 'rgba(99,102,241,0.15)', color: '#4F46E5', fontWeight: 600 }}>📄 {s}</span>)}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={16} style={{ color: '#fff' }} />
            </div>
            <div style={{ padding: '14px 18px', background: '#FFFFFF', borderRadius: '4px 16px 16px 16px', border: '1px solid #E2E2E6', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 1, 2].map(i => <div key={i} className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions — always visible, role-based */}
      <div style={{ padding: '8px 36px 12px', borderTop: '1px solid #F2F2F4', background: '#FAFAFA' }}>
        <p style={{ fontSize: 11, color: '#9999a6', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Suggestions pour {role}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s)}
              disabled={loading}
              style={{
                padding: '7px 14px',
                background: '#FFFFFF',
                border: '1px solid #E2E2E6',
                borderRadius: 99,
                fontSize: 12.5,
                color: '#44444B',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: loading ? 0.5 : 1,
                transition: 'border-color 0.15s',
              }}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '16px 36px 24px', background: '#FFFFFF', borderTop: '1px solid #F2F2F4' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Posez votre question à l'assistant RH…"
            style={{ flex: 1, padding: '12px 18px', border: '1px solid #E2E2E6', borderRadius: 12, fontSize: 13.5, color: '#1A1A1E', outline: 'none', fontFamily: 'inherit', background: '#FFFFFF' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading}
            style={{ width: 44, height: 44, borderRadius: 12, background: loading ? '#3730a3' : '#6366f1', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(99,102,241,0.35)' }}
          >
            <Send size={17} style={{ color: '#fff' }} />
          </button>
        </div>
      </div>
    </div>
  )
}
