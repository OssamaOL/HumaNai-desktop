import { useState } from 'react'
import { LayoutDashboard, Users, CalendarOff, FileText, MessageSquare, UserPlus, BarChart2, Settings, X, BookOpen, Zap, Shield, HelpCircle, Heart, LogOut, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// ── Page order reflects the HR workflow: hire → integrate → manage → exit
const ALL_PAGES = [
  { icon: LayoutDashboard, label: 'Tableau de bord', id: 'dashboard',   roles: ['admin','rh','manager','collaborateur','direction','qvt'] },
  { icon: Users,           label: 'Collaborateurs',  id: 'employees',   roles: ['admin','rh','manager','direction'] },
  { icon: CalendarOff,     label: 'Absences',        id: 'absences',    roles: ['admin','rh','manager'] },
  { icon: UserPlus,        label: 'Intégration',     id: 'onboarding',  roles: ['admin','rh','manager'] },
  { icon: LogOut,          label: 'Offboarding',     id: 'offboarding', roles: ['admin','rh'] },
  { icon: FileText,        label: 'Documents',       id: 'documents',   roles: ['admin','rh','manager'] },
  { icon: Heart,           label: 'Engagement',      id: 'engagement',  roles: ['admin','rh','manager','qvt'] },
  { icon: BarChart2,       label: 'Analytique',      id: 'analytics',   roles: ['admin','rh','direction'] },
  { icon: MessageSquare,   label: 'Assistant IA',    id: 'assistant',   roles: ['admin','rh','manager','collaborateur','direction','qvt'] },
  { icon: Eye,             label: 'Supervision IA',  id: 'supervision', roles: ['admin'] },
  { icon: Settings,        label: 'Paramètres',      id: 'settings',    roles: ['admin','rh','manager','collaborateur','direction','qvt'] },
]

const HELP_SECTIONS = [
  {
    icon: BookOpen, color: '#4F46E5', bg: 'rgba(99,102,241,0.1)',
    title: 'Guides rapides',
    items: [
      {
        q: 'Générer un document RH',
        a: 'Documents → « Générer un document » → choisissez un template (attestation, courrier…) et un collaborateur → cliquez Générer. Le document est disponible au téléchargement immédiatement.',
      },
      {
        q: 'Approuver ou refuser une absence',
        a: 'Absences → les demandes « En attente » affichent les boutons Approuver / Refuser. Cliquez pour mettre à jour le statut. Un Reset est disponible pour annuler une décision.',
      },
      {
        q: 'Lancer un plan d\'intégration',
        a: 'Intégration → sélectionnez un collaborateur → cliquez « Générer un plan ». L\'IA crée un programme structuré sur 30 jours avec les étapes clés.',
      },
      {
        q: 'Initier un offboarding',
        a: 'Offboarding → cliquez « Initier un départ » → renseignez le collaborateur, la raison et la date. Le système génère automatiquement les étapes de conformité.',
      },
      {
        q: 'Consulter les scores d\'engagement',
        a: 'Engagement → visualisez les scores de satisfaction et les signaux de désengagement par collaborateur. Des alertes automatiques sont générées pour les cas critiques.',
      },
      {
        q: 'Supervision IA (Admin)',
        a: 'Supervision IA → consultez les logs de toutes les conversations, les tentatives de prompt injection détectées et le score de risque global de la plateforme.',
      },
    ]
  },
  {
    icon: Zap, color: '#B45309', bg: 'rgba(245,158,11,0.1)',
    title: 'Assistant IA — questions types',
    items: [
      {
        q: 'Questions directes sur les données',
        a: '« Montre-moi toutes les absences », « Liste les collaborateurs en CDI », « Quels sont les documents générés ce mois ? » — posez la question simplement, l\'IA récupère les données.',
      },
      {
        q: 'Questions sur les congés',
        a: '« Quelle est la politique de congés payés ? », « Qui est en congé cette semaine ? », « Combien de jours de RTT restent-il ? »',
      },
      {
        q: 'Questions RH générales',
        a: '« Quelles sont les étapes d\'onboarding ? », « Comment fonctionne l\'entretien annuel ? », « Quels documents sont obligatoires à l\'embauche ? »',
      },
      {
        q: 'Analyse et prédiction',
        a: '« Quel est le risque de turnover dans l\'équipe IT ? », « Qui présente des signaux de désengagement ? », « Quel est le taux d\'absentéisme ce mois ? »',
      },
    ]
  },
  {
    icon: Shield, color: '#059669', bg: 'rgba(16,185,129,0.1)',
    title: 'Rôles & accès',
    items: [
      {
        q: 'Admin',
        a: 'Accès complet : tous les modules, supervision IA, journal de sécurité, gestion des utilisateurs et paramètres avancés.',
      },
      {
        q: 'RH',
        a: 'Gestion complète des collaborateurs, documents, absences, onboarding, offboarding et consultation de l\'analytique.',
      },
      {
        q: 'Manager',
        a: 'Accès aux collaborateurs, absences (approbation), documents, intégration et engagement de son équipe.',
      },
      {
        q: 'Collaborateur',
        a: 'Accès à son propre profil via l\'assistant IA et ses paramètres uniquement.',
      },
      {
        q: 'QVT (Médecine du travail)',
        a: 'Accès au tableau de bord, à l\'assistant IA et aux scores d\'engagement — lecture seule sur les signaux de désengagement.',
      },
    ]
  },
]

export default function Sidebar({ activePage, setActivePage }) {
  const { user } = useAuth()
  const [showHelp, setShowHelp]       = useState(false)
  const [openSection, setOpenSection] = useState(0)
  const [collapsed, setCollapsed]     = useState(false)

  const role         = user?.role || 'collaborateur'
  const visiblePages = ALL_PAGES.filter(p => p.roles.includes(role))
  const W            = collapsed ? 64 : 220

  return (
    <>
      <div style={{
        width: W, minWidth: W, height: '100vh',
        background: '#FFFFFF', borderRight: '1px solid #F2F2F4',
        display: 'flex', flexDirection: 'column',
        padding: collapsed ? '20px 10px' : '20px 12px',
        overflowY: 'auto', overflowX: 'hidden',
        transition: 'width 0.2s ease, min-width 0.2s ease',
      }}>

        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', marginBottom: 28, padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #4F46E5, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(99,102,241,0.3)', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>H</span>
            </div>
            {!collapsed && (
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1E', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>HumaNai</span>
            )}
          </div>

          {/* Collapse / expand button */}
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Agrandir le menu' : 'Réduire le menu'}
            style={{
              width: 26, height: 26, borderRadius: 7,
              border: '1px solid #E2E2E6', background: '#F7F7F9',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#71717a', flexShrink: 0,
              marginLeft: collapsed ? 'auto' : 0,
              marginRight: collapsed ? 'auto' : 0,
              marginTop: collapsed ? 8 : 0,
            }}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visiblePages.map(({ icon: Icon, label, id }) => {
            const isActive = activePage === id
            return (
              <button
                key={id}
                onClick={() => setActivePage(id)}
                title={collapsed ? label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '10px 0' : '10px 12px',
                  borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#4F46E5' : '#71717a',
                  background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                  textAlign: 'left', width: '100%', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#F7F7F9'; e.currentTarget.style.color = '#1A1A1E' } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717a' } }}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                {!collapsed && label}
              </button>
            )
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Help — full block when expanded, icon only when collapsed */}
        {!collapsed ? (
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
        ) : (
          <button
            onClick={() => setShowHelp(true)}
            title="Aide"
            style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5', margin: '0 auto' }}
          >
            <HelpCircle size={16} />
          </button>
        )}
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
