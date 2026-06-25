// src/services/api.js — all backend calls, wired to new backend
// Base URL now includes /api/v1 prefix
// Auth uses Firebase idToken (not JWT access_token)
// All responses are wrapped in { data: ... } — unwrapped here

const BASE_URL = 'http://localhost:8000/api/v1'

let _token = null
export function setToken(token) { _token = token }
export function getToken() { return _token }
export function clearToken() { _token = null }

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`
  const options = { method, headers }
  if (body) options.body = JSON.stringify(body)
  const response = await fetch(`${BASE_URL}${path}`, options)
  if (response.status === 401) { clearToken(); throw new Error('Session expirée — veuillez vous reconnecter') }
  if (response.status === 204) return {}
  const json = await response.json()
  if (!response.ok) throw new Error(json.detail || 'Erreur serveur')
  // Unwrap { data: ... } envelope when present
  return json.data !== undefined ? json.data : json
}

// ── Auth ──────────────────────────────────────────────────────────────────────
// New backend returns { idToken, refreshToken } not { access_token }
export const authAPI = {
  login:    (email, password) => fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(async r => {
    const json = await r.json()
    if (!r.ok) throw new Error(json.detail || 'Identifiants invalides')
    return json  // { idToken, refreshToken, expiresIn }
  }),
  logout:   () => request('POST', '/auth/logout'),
  me:       () => request('GET',  '/auth/me'),
  signup:   (email, password, display_name, role) =>
    request('POST', '/auth/signup', { email, password, display_name, role }),
}

// ── Employees ─────────────────────────────────────────────────────────────────
export const employeesAPI = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/employees/${qs ? '?' + qs : ''}`)
  },
  get:    (id)     => request('GET', `/employees/${id}`),
  create: (data)   => request('POST', '/employees/', data),
  update: (id, data) => request('PUT', `/employees/${id}`, data),
}

// ── Absences ──────────────────────────────────────────────────────────────────
export const absencesAPI = {
  list:    (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/absences/${qs ? '?' + qs : ''}`)
  },
  approve: (id)    => request('POST', `/absences/${id}/approve`),
  reject:  (id, rejection_reason) =>
    request('POST', `/absences/${id}/reject`, { rejection_reason }),
  stats:   ()      => request('GET', '/absences/stats'),
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsAPI = {
  listTemplates: () => request('GET', '/documents/templates/'),
  list:          () => request('GET', '/documents/all'),
  generate:      (template_id, employee_id) =>
    request('POST', '/documents/generate', { template_id, employee_id }),
  download:      (doc_id) =>
    fetch(`${BASE_URL}/documents/${doc_id}/download`, {
      headers: { 'Authorization': `Bearer ${_token}` },
    }).then(r => r.json()),  // returns { download_url }
  validate:      (doc_id) => request('POST', `/documents/${doc_id}/validate`),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  overview:    () => request('GET', '/dashboard/overview'),
  kpis:        () => request('GET', '/dashboard/kpis'),
  turnover:    () => request('GET', '/dashboard/turnover'),
  absenteeism: () => request('GET', '/dashboard/absenteeism'),
  engagement:  () => request('GET', '/dashboard/engagement'),
}

// ── Alerts ────────────────────────────────────────────────────────────────────
export const alertsAPI = {
  list:    () => request('GET', '/alerts/'),
  resolve: (id, notes) => request('POST', `/alerts/${id}/resolve`, { resolution_notes: notes }),
  stats:   () => request('GET', '/alerts/stats'),
}

// ── Assistant ─────────────────────────────────────────────────────────────────
export const assistantAPI = {
  chat:      (message, session_id = null) =>
    request('POST', '/assistant/chat', { message, session_id }),
  suggested: () => request('GET', '/assistant/suggested'),
}

// ── Onboarding ────────────────────────────────────────────────────────────────
export const onboardingAPI = {
  list:     ()            => request('GET',  '/onboarding/'),
  generate: (employee_id) => request('POST', '/onboarding/generate', { employee_id }),
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminAPI = {
  getAuditLogs:      () => request('GET', '/audit/logs'),
  getSecurityEvents: () => request('GET', '/alerts/security/events'),
}

// ── System ────────────────────────────────────────────────────────────────────
export const systemAPI = {
  health: () => fetch('http://localhost:8000/').then(r => r.json()),
}
