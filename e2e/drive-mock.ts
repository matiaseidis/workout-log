import type { BrowserContext, Route } from '@playwright/test'

/**
 * In-memory fake of the Drive REST v3 surface the app uses, installed as
 * Playwright routes. Lives in the test process, so tests can inspect state
 * (files, upload counts) and inject failures (offline, 500s, 401s).
 */
export interface MockFile {
  id: string
  name: string
  mimeType: string
  parents: string[]
  appProperties?: Record<string, string>
  content?: string
}

export interface DriveState {
  files: Map<string, MockFile>
  nextId: number
  /** POST upload attempts (including failed ones). */
  uploads: number
  /** PATCH/PUT/DELETE calls — the append-only invariant demands this stays 0. */
  mutations: number
  /** Fail the next N upload attempts with HTTP 500. */
  failUploads: number
  /** Abort all Drive traffic like a dead network. */
  offline: boolean
  /** Reject everything with 401 (expired/revoked token). */
  reject401: boolean
}

export function newDriveState(): DriveState {
  return { files: new Map(), nextId: 1, uploads: 0, mutations: 0, failUploads: 0, offline: false, reject401: false }
}

export function sessionFiles(state: DriveState): MockFile[] {
  return [...state.files.values()].filter((f) => f.appProperties?.wlog === '1')
}

export function folderByName(state: DriveState, name: string): MockFile | undefined {
  return [...state.files.values()].find((f) => f.mimeType === FOLDER_MIME && f.name === name)
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

const GIS_STUB = `
window.google = { accounts: { oauth2: { initTokenClient: (cfg) => ({
  requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'mock-token', expires_in: 3600 }), 0),
}) } } };
`

export async function installDriveMock(context: BrowserContext, state: DriveState): Promise<void> {
  // the app reads this to enable the Connect button; any non-placeholder value works with the GIS stub
  await context.addInitScript(() => {
    localStorage.setItem('wlog_client_id', 'e2e-test-client.apps.googleusercontent.com')
  })
  await context.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: GIS_STUB }),
  )
  await context.route('https://www.googleapis.com/**', (route) => handle(route, state))
}

function handle(route: Route, state: DriveState): Promise<void> {
  const req = route.request()
  const url = new URL(req.url())
  const method = req.method()

  if (state.offline) return route.abort('internetdisconnected')
  if (state.reject401) return route.fulfill({ status: 401, json: { error: 'invalid_token' } })

  if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
    state.mutations++
    return route.fulfill({ json: {} })
  }

  // files.list
  if (method === 'GET' && url.pathname === '/drive/v3/files') {
    const q = url.searchParams.get('q') ?? ''
    if (q.includes(FOLDER_MIME)) {
      const name = /name = '((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replaceAll("\\'", "'")
      const parent = /'([^']*)' in parents/.exec(q)?.[1] ?? 'root'
      const files = [...state.files.values()].filter(
        (f) => f.mimeType === FOLDER_MIME && f.name === name && f.parents[0] === parent,
      )
      return route.fulfill({ json: { files } })
    }
    return route.fulfill({ json: { files: sessionFiles(state) } })
  }

  // files.get?alt=media
  if (method === 'GET' && url.pathname.startsWith('/drive/v3/files/')) {
    const id = url.pathname.split('/').pop()!
    const f = state.files.get(id)
    if (!f) return route.fulfill({ status: 404, body: 'not found' })
    return route.fulfill({ contentType: 'text/csv', body: f.content ?? '' })
  }

  // folder create
  if (method === 'POST' && url.pathname === '/drive/v3/files') {
    const meta = req.postDataJSON() as { name: string; mimeType: string; parents?: string[] }
    const id = `fld-${state.nextId++}`
    state.files.set(id, { id, name: meta.name, mimeType: meta.mimeType, parents: meta.parents ?? ['root'] })
    return route.fulfill({ json: { id } })
  }

  // multipart upload
  if (method === 'POST' && url.pathname === '/upload/drive/v3/files') {
    state.uploads++
    if (state.failUploads > 0) {
      state.failUploads--
      return route.fulfill({ status: 500, body: 'injected failure' })
    }
    const boundary = /boundary=([^\s;]+)/.exec(req.headers()['content-type'] ?? '')?.[1]
    const body = req.postData() ?? ''
    const parts = body.split(`--${boundary}`).filter((p) => p.includes('Content-Type'))
    const metaRaw = parts[0].slice(parts[0].indexOf('\r\n\r\n') + 4)
    const meta = JSON.parse(metaRaw.trim()) as { name: string; parents: string[]; appProperties: Record<string, string> }
    const content = parts[1].slice(parts[1].indexOf('\r\n\r\n') + 4).replace(/\r\n$/, '')
    const id = `file-${state.nextId++}`
    state.files.set(id, { id, name: meta.name, mimeType: 'text/csv', parents: meta.parents, appProperties: meta.appProperties, content })
    return route.fulfill({ json: { id } })
  }

  return route.fulfill({ status: 400, body: `drive mock: unhandled ${method} ${url.pathname}` })
}
