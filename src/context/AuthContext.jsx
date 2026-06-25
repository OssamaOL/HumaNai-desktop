import { createContext, useContext, useState } from 'react'
import { authAPI, setToken, clearToken } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  async function login(email, password) {
    setLoading(true); setError(null)
    try {
      // New backend returns { idToken, refreshToken, expiresIn }
      const data = await authAPI.login(email, password)
      const token = data.idToken
      if (!token) throw new Error('Token non reçu')
      setToken(token)

      // Fetch user profile with the new token
      const me = await authAPI.me()
      // /auth/me returns { uid, email, role, dept_id, display_name, db_user }
      setUser({
        id:        me.uid || me.db_user,
        email:     me.email,
        full_name: me.display_name || me.email,
        role:      me.role,
        dept_id:   me.dept_id,
      })
      return true
    } catch (err) {
      setError(err.message)
      clearToken()
      return false
    } finally { setLoading(false) }
  }

  async function logout() {
    try { await authAPI.logout() } catch {}
    clearToken(); setUser(null)
  }

  // Name update not supported in new backend via a simple PATCH yet
  // Kept for Settings page compatibility — updates local state only
  async function updateUser(newFullName) {
    setUser(prev => ({ ...prev, full_name: newFullName }))
    return { ...user, full_name: newFullName }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error, setError, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
