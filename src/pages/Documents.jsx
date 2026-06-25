import { useEffect, useState } from 'react'
import { Plus, Download, Trash2, RefreshCw } from 'lucide-react'
import { documentsAPI, employeesAPI } from '../services/api'

const typeMeta = {
  attestation: { label: 'Attestation', icon: '📄', color: '#4F46E5', bg: 'rgba(99,102,241,0.15)' },
  formulaire:  { label: 'Formulaire',  icon: '📋', color: '#B45309', bg: 'rgba(245,158,11,0.15)' },
  'synthèse':  { label: 'Synthèse',    icon: '⭐', color: '#9333EA', bg: 'rgba(168,85,247,0.15)' },
  courrier:    { label: 'Courrier',    icon: '✉️', color: '#059669', bg: 'rgba(16,185,129,0.15)' },
  offboarding: { label: 'Offboarding', icon: '📘', color: '#2563EB', bg: 'rgba(59,130,246,0.15)' },
}
const fallbackMeta = { label: 'Document', icon: '📄', color: '#44444B', bg: '#F2F2F4' }

export default function Documents() {
  const [docs, setDocs] = useState([])
  const [templates, setTemplates] = useState([])
  const [employees, setEmployees] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState(null)
  const [genError, setGenError] = useState(null)

  const inputStyle = { padding: '10px 14px', border: '1.5px solid #E2E2E6', borderRadius: 10, fontSize: 13.5, outline: 'none', fontFamily: 'inherit', background: '#FFFFFF', color: '#1A1A1E' }

  async function loadAll() {
    setLoadingData(true)
    setLoadError(null)
    try {
      const [tplRes, empRes, docRes] = await Promise.all([
        documentsAPI.listTemplates(),
        employeesAPI.list(),
        documentsAPI.list(),
      ])
      setTemplates(tplRes)
      setEmployees(empRes)
      setDocs(docRes)
      if (!templateId && tplRes.length) setTemplateId(tplRes[0].id)
      if (!employeeId && empRes.length) setEmployeeId(empRes[0].id)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const templateById = Object.fromEntries(templates.map(t => [t.id, t]))
  const employeeById = Object.fromEntries(employees.map(e => [e.id, e]))

  async function handleGenerate(e) {
    e.preventDefault()
    if (!templateId || !employeeId) { setGenError('Please select a template and an employee.'); return }
    setGenerating(true); setGenResult(null); setGenError(null)
    try {
      const result = await documentsAPI.generate(templateId, employeeId)
      // FIX: backend returns { document_id, status } — not { id }
      setGenResult(`Document generated — ID: ${result.document_id} (${result.status})`)
      setShowForm(false)
      const fresh = await documentsAPI.list()
      setDocs(fresh)
    } catch (err) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload(docId) {
    try {
      const result = await documentsAPI.download(docId)
      if (result.download_url) {
        window.open(result.download_url, '_blank')
      } else {
        alert('Download link not available — the document may still be generating.')
      }
    } catch { alert('Download failed') }
  }
  function removeDoc(id) { setDocs(prev => prev.filter(d => d.id !== id)) }

  return (
    <div style={{ padding: '32px 36px', background: '#F7F7F9', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1A1A1E' }}>Documents</h1>
          <p style={{ fontSize: 13.5, color: '#71717a', marginTop: 4 }}>HR document repository</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadAll} title="Refresh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, background: '#FFFFFF', color: '#44444B', border: '1px solid #E2E2E6', borderRadius: 10, cursor: 'pointer' }}>
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 16px rgba(99,102,241,0.35)' }}>
            <Plus size={15} /> Generate Document
          </button>
        </div>
      </div>

      {loadError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
          Load error: {loadError}
        </div>
      )}

      {showForm && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '20px', marginBottom: 20, border: '1px solid #E2E2E6' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1E', marginBottom: 12 }}>Generate New Document</p>
          {templates.length === 0 || employees.length === 0 ? (
            <p style={{ fontSize: 12.5, color: '#71717a' }}>
              {templates.length === 0 && 'No templates available. '}
              {employees.length === 0 && 'No employees available. '}
              Make sure the backend is running and the database is seeded.
            </p>
          ) : (
            <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select value={templateId} onChange={e => setTemplateId(e.target.value)} required style={inputStyle}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} required style={inputStyle}>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.matricule})</option>)}
              </select>
              <button type="submit" disabled={generating} style={{ padding: '10px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: generating ? 'default' : 'pointer', opacity: generating ? 0.7 : 1 }}>{generating ? 'Generating…' : 'Generate'}</button>
            </form>
          )}
          {genError && <p style={{ fontSize: 12.5, color: '#DC2626', marginTop: 8 }}>{genError}</p>}
        </div>
      )}
      {genResult && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#059669', fontWeight: 500 }}>{genResult}</div>}

      {loadingData ? (
        <p style={{ fontSize: 13.5, color: '#71717a' }}>Loading documents…</p>
      ) : docs.length === 0 ? (
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E2E6', padding: '40px', textAlign: 'center', color: '#71717a', fontSize: 13.5 }}>
          No documents yet — generate one above.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {docs.map((doc) => {
            const tpl = templateById[doc.template_id]
            const emp = employeeById[doc.employee_id]
            const meta = typeMeta[tpl?.type] || fallbackMeta
            const title = tpl ? `${tpl.name}${emp ? ' — ' + emp.full_name : ''}` : `Document ${doc.id.slice(0, 8)}`
            const date = doc.generated_at ? new Date(doc.generated_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : ''
            return (
              <div key={doc.id} style={{ background: '#FFFFFF', borderRadius: 14, padding: '18px 20px', border: '1px solid #E2E2E6', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{meta.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: '#1A1A1E', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 99 }}>{meta.label}</span>
                    <span style={{ fontSize: 11.5, color: '#71717a' }}>{doc.status} · {date}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => handleDownload(doc.id)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E2E2E6', background: '#F2F2F4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#44444B' }}><Download size={14} /></button>
                  <button onClick={() => removeDoc(doc.id)} title="Remove from this view (does not delete on server)" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
