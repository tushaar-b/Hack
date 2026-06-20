import { create } from 'zustand'
import { API_URL } from '../lib/supabase'

const SESSION_KEY = 'neurox_notion_user'

export const useAuthStore = create((set) => ({
  user:        null,
  session:     null,
  initialized: false,

  // ─── Bootstrap ────────────────────────────────────────────────────────────
  initialize: () => {
    try {
      const stored = localStorage.getItem(SESSION_KEY)
      if (stored) {
        const user = JSON.parse(stored)
        set({ user, session: { user }, initialized: true })
        return
      }
    } catch (_) {}
    set({ initialized: true })
  },

  // ─── Sign In (Notion) ─────────────────────────────────────────────────────
  signIn: async (email, password) => {
    const res = await fetch(`${API_URL}/notion/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Invalid email or password')

    const user = data.user
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    set({ user, session: { user } })
    return data
  },

  // ─── Sign In (SSO) ────────────────────────────────────────────────────────
  ssoLogin: async (token) => {
    const res = await fetch(`${API_URL}/notion/sso`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'SSO login failed')

    const user = data.user
    localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    set({ user, session: { user } })
    return data
  },

  // ─── Sign Up (Notion) ─────────────────────────────────────────────────────
  signUp: async (name, email, password) => {
    const res = await fetch(`${API_URL}/notion/signup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || 'Registration failed')
    return data
  },

  // ─── Sign Out ─────────────────────────────────────────────────────────────
  signOut: async () => {
    localStorage.removeItem(SESSION_KEY)
    set({ user: null, session: null })
  },
}))
