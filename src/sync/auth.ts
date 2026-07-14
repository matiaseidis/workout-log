/**
 * Google Identity Services token client wrapper. Pure client-side OAuth:
 * short-lived access tokens, no refresh token. Silent re-auth (prompt: '')
 * works while the Google session cookie lives and consent was granted;
 * otherwise callers surface a "Reconnect" affordance (interactive re-auth
 * must come from a user gesture, notably in iOS standalone mode).
 *
 * The client ID is public by design (an identifier, not a secret).
 */
const DEFAULT_CLIENT_ID = 'REPLACE_WITH_CLIENT_ID.apps.googleusercontent.com'
export const SCOPE = 'https://www.googleapis.com/auth/drive.file'

export function clientId(): string {
  return localStorage.getItem('wlog_client_id') ?? DEFAULT_CLIENT_ID
}
export function clientIdConfigured(): boolean {
  return !clientId().startsWith('REPLACE_WITH')
}

/* global loaded by the GIS script */
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(cfg: {
            client_id: string
            scope: string
            callback: (resp: { access_token?: string; expires_in?: number | string; error?: string }) => void
            error_callback?: (e: { type?: string }) => void
          }): { requestAccessToken(opts?: { prompt?: string }): void }
        }
      }
    }
  }
}

let gisLoading: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = () => resolve()
    s.onerror = () => {
      gisLoading = null
      reject(new Error('Could not load Google sign-in (offline?)'))
    }
    document.head.appendChild(s)
  })
  return gisLoading
}

interface CachedToken {
  value: string
  expiresAt: number
}
let token: CachedToken | null = null
const TOKEN_KEY = 'wlog_token'

function readStoredToken(): CachedToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as CachedToken) : null
  } catch {
    return null
  }
}

export function isConnected(): boolean {
  return localStorage.getItem('wlog_drive') === '1'
}
export function setConnected(v: boolean) {
  if (v) localStorage.setItem('wlog_drive', '1')
  else {
    localStorage.removeItem('wlog_drive')
    sessionStorage.removeItem(TOKEN_KEY)
    token = null
  }
}
export function invalidateToken() {
  token = null
  sessionStorage.removeItem(TOKEN_KEY)
}

/**
 * Get an access token. `interactive` allows the consent popup (first connect
 * or reconnect — must be called from a user gesture); otherwise silent only.
 */
export async function getAccessToken(interactive: boolean): Promise<string> {
  const cached = token ?? readStoredToken()
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    token = cached
    return cached.value
  }
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) return reject(new Error(resp.error ?? 'no_token'))
        token = { value: resp.access_token, expiresAt: Date.now() + (Number(resp.expires_in) || 3600) * 1000 }
        try {
          sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token))
        } catch {
          /* private mode — in-memory token still works */
        }
        resolve(resp.access_token)
      },
      error_callback: (e) => reject(new Error(e?.type ?? 'auth_failed')),
    })
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' })
  })
}
