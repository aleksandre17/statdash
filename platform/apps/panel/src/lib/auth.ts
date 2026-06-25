// ── Panel auth — JWT token lifecycle ─────────────────────────────────────────
//
//  Single seam for everything token-related in the panel:
//    login()     → exchanges credentials for a JWT via POST /api/auth/login
//    getToken()  → reads the current JWT from sessionStorage
//    setToken()  → persists the JWT for the session
//    clearToken()→ removes the JWT (on logout or 401)
//
//  Pattern: session-scoped (sessionStorage, not localStorage) — token evaporates
//  when the tab closes, matching the single-admin-at-a-time Constructor use-case.
//  Switch to localStorage + expiry check if persistence across sessions is needed.
//

const TOKEN_KEY = 'geostat_panel_token'

// Empty fallback → relative `/api/...` (same-origin). Dev supplies VITE_API_URL
// (or the Vite proxy); only the production fallback is relative. See ADR
// deployment-topology RC-2 / D1 (single-origin, CORS-free).
const BASE = import.meta.env.VITE_API_URL ?? ''

// ── Storage helpers ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return getToken() !== null
}

// ── Login ─────────────────────────────────────────────────────────────────────
//
//  Sends credentials to POST /api/auth/login — mirrors the `{ data: { token } }`
//  envelope the Fastify API returns. Stores the token on success.
//  Throws AuthError on bad credentials (401) or a plain Error on network failure.

export class AuthError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

interface LoginResponse {
  data?: { token: string }
  error?: string
  message?: string
}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  const json = (await res.json()) as LoginResponse

  if (!res.ok || json.error) {
    throw new AuthError(res.status, json.message ?? json.error ?? 'Login failed')
  }

  const token = json.data?.token
  if (!token) throw new AuthError(500, 'No token in login response')

  setToken(token)
  return token
}

// ── Logout ─────────────────────────────────────────────────────────────────────

export function logout(): void {
  clearToken()
}
