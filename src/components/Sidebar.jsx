import { useState } from 'react'
import { LayoutDashboard, Users, CalendarOff, FileText, MessageSquare, UserPlus, BarChart2, Settings, X, BookOpen, Zap, Shield, HelpCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// ── Page access rules ─────────────────────────────────────────────────────────
// admin    → all pages
// rh       → all pages except admin-only (security is settings tab, not a page)
// manager  → dashboard, employees, absences, documents, assistant, onboarding, analytics, settings
// collaborateur → dashboard, assistant, settings only
const ALL_PAGES = [
  { icon: LayoutDashboard, label: 'Tableau de bord', id: 'dashboard',  roles: ['admin','rh','manager','collaborateur','direction','qvt'] },
  { icon: Users,           label: 'Collaborateurs',  id: 'employees',  roles: ['admin','rh','manager','direction'] },
  { icon: CalendarOff,     label: 'Absences',        id: 'absences',   roles: ['admin','rh','manager'] },
  { icon: FileText,        label: 'Documents',       id: 'documents',  roles: ['admin','rh','manager'] },
  { icon: MessageSquare,   label: 'Assistant IA',    id: 'assistant',  roles: ['admin','rh','manager','collaborateur','direction','qvt'] },
  { icon: UserPlus,        label: 'Intégration',     id: 'onboarding', roles: ['admin','rh','manager'] },
  { icon: BarChart2,       label: 'Analytique',      id: 'analytics',  roles: ['admin','rh','direction'] },
  { icon: Settings,        label: 'Paramètres',      id: 'settings',   roles: ['admin','rh','manager','collaborateur','direction','qvt'] },
]

const HELP_SECTIONS = [
  {
    icon: BookOpen, color: '#4F46E5', bg: 'rgba(99,102,241,0.1)',
    title: 'Guides rapides',
    items: [
      { q: 'Générer un document RH', a: 'Allez dans Documents → cliquez sur « Générer un document » → choisissez un template (attestation, courrier…) et un collaborateur dans les menus déroulants → cliquez Générer.' },
      { q: 'Approuver une absence', a: 'Allez dans Absences → les demandes « En attente » affichent les boutons Approuver / Refuser. Cliquez pour mettre à jour le statut immédiatement.' },
      { q: 'Générer un plan d\'intégration', a: 'Allez dans Intégration → sélectionnez un collaborateur → cliquez « Générer un plan ». L\'IA crée automatiquement un programme de 30 jours.' },
      { q: 'Calculer les KPIs RH', a: 'Allez dans Analytique → cliquez « Calculer les KPIs ». Les données sont enregistrées et visibles sur le tableau de bord.' },
    ]
  },
  {
    icon: Zap, color: '#B45309', bg: 'rgba(245,158,11,0.1)',
    title: 'Assistant IA — questions types',
    items: [
      { q: 'Questions sur les effectifs', a: '« Combien de collaborateurs sont en CDI ? », « Qui a été recruté ce trimestre ? », « Quel est le taux d\'absentéisme ce mois ? »' },
      { q: 'Questions sur les congés', a: '« Quelle est la politique de congés payés ? », « Combien de jours de RTT restent-il ? », « Comment poser un congé sans solde ? »' },
      { q: 'Questions RH générales', a: '« Quelles sont les étapes d\'onboarding ? », « Comment fonctionne l\'entretien annuel ? », « Quels documents sont obligatoires à l\'embauche ? »' },
      { q: 'Analyse prédictive', a: '« Quel est le risque de turnover dans l\'équipe IT ? », « Qui présente des signaux de désengagement ? »' },
    ]
  },
  {
    icon: Shield, color: '#059669', bg: 'rgba(16,185,129,0.1)',
    title: 'Rôles & accès',
    items: [
      { q: 'Admin', a: 'Accès complet : tous les modules, journal de sécurité, gestion des utilisateurs, supervision IA.' },
      { q: 'RH', a: 'Gestion complète des collaborateurs, documents, absences, onboarding et offboarding.' },
      { q: 'Manager', a: 'Accès aux collaborateurs, absences, documents, intégration. Lecture seule sur son équipe.' },
      { q: 'Collaborateur', a: 'Accès à son propre profil, l\'assistant IA et ses paramètres uniquement.' },
    ]
  },
]

export default function Sidebar({ activePage, setActivePage }) {
  const { user } = useAuth()
  const [showHelp, setShowHelp]     = useState(false)
  const [openSection, setOpenSection] = useState(0)

  const role = user?.role || 'collaborateur'
  const visiblePages = ALL_PAGES.filter(p => p.roles.includes(role))

  return (
    <>
      <div style={{ width: 220, minWidth: 220, height: '100vh', background: '#FFFFFF', borderRight: '1px solid #F2F2F4', display: 'flex', flexDirection: 'column', padding: '20px 12px', overflowY: 'auto' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, padding: '0 8px' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #4F46E5, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(99,102,241,0.3)' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>H</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1E', letterSpacing: '-0.3px' }}>HumaNai</span>
        </div>

        {/* Nav — filtered by role */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visiblePages.map(({ icon: Icon, label, id }) => {
            const isActive = activePage === id
            return (
              <button key={id} onClick={() => setActivePage(id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: isActive ? 600 : 500, color: isActive ? '#4F46E5' : '#71717a', background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#F7F7F9'; e.currentTarget.style.color = '#1A1A1E' } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717a' } }}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />{label}
              </button>
            )
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Help block */}
        <div style={{ marginTop: 16, background: 'linear-gradient(135deg, rgba(99,102,241,0.07), rgba(99,102,241,0.02))', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 14, padding: '16px 14px', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, background: 'rgba(99,102,241,0.12)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', border: '1px solid rgba(99,102,241,0.2)' }}>
            <HelpCircle size={18} style={{ color: '#4F46E5' }} />
          </div>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: '#1A1A1E', marginBottom: 5 }}>Besoin d'aide ?</p>
          <p style={{ fontSize: 11, color: '#71717a', lineHeight: 1.6, marginBottom: 12 }}>Guides, rôles et questions types pour l'assistant IA.</p>
          <button onClick={() => setShowHelp(true)} style={{ width: '100%', padding: '8px 0', background: '#4F46E5', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            Voir l'aide
          </button>
        </div>
      </div>

      {/* Help modal */}
      {showHelp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowHelp(false)}>
          <div style={{ background: '#FFFFFF', borderRadius: 20, width: 640, maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #E2E2E6' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1A1A1E' }}>Centre d'aide HumaNai</h2>
                <p style={{ fontSize: 12.5, color: '#71717a', marginTop: 3 }}>Guides, rôles, et questions types pour l'assistant IA</p>
              </div>
              <button onClick={() => setShowHelp(false)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E2E2E6', background: '#F7F7F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a' }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '14px 24px', borderBottom: '1px solid #E2E2E6', background: '#F7F7F9' }}>
              {HELP_SECTIONS.map((s, i) => (
                <button key={i} onClick={() => setOpenSection(i)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, border: openSection === i ? `1px solid ${s.color}` : '1px solid #E2E2E6', background: openSection === i ? s.bg : '#FFFFFF', color: openSection === i ? s.color : '#71717a', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <s.icon size={14} />{s.title}
                </button>
              ))}
            </div>
            <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {HELP_SECTIONS[openSection].items.map(({ q, a }, i) => (
                <div key={i} style={{ background: '#F7F7F9', borderRadius: 12, padding: '14px 16px', border: '1px solid #E2E2E6' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: HELP_SECTIONS[openSection].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: HELP_SECTIONS[openSection].color }}>{i + 1}</span>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1E', lineHeight: 1.4 }}>{q}</p>
                  </div>
                  <p style={{ fontSize: 12.5, color: '#71717a', lineHeight: 1.6, paddingLeft: 32 }}>{a}</p>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #E2E2E6', background: '#F7F7F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11.5, color: '#9A9AA2' }}>HumaNai · YDAYS 2026 · Ynov Campus Maroc</span>
              <button onClick={() => setShowHelp(false)} style={{ padding: '7px 18px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
