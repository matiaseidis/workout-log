/**
 * Thin fetch wrappers over the Drive REST v3 API (drive.file scope: the app
 * only ever sees files it created). Files are identified by
 * appProperties.sessionId — filenames are for humans browsing Drive.
 */
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

export class DriveAuthError extends Error {
  constructor() {
    super('Drive rejected the access token')
  }
}

export interface RemoteFile {
  id: string
  name: string
  sessionId: string
  parents: string[]
}

async function req(token: string, url: string, init?: RequestInit): Promise<Response> {
  const r = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  })
  if (r.status === 401 || r.status === 403) throw new DriveAuthError()
  if (!r.ok) throw new Error(`Drive request failed (${r.status})`)
  return r
}

export async function ensureFolder(token: string, name: string, parentId?: string): Promise<string> {
  const q = [
    `name = '${name.replaceAll("'", "\\'")}'`,
    `mimeType = '${FOLDER_MIME}'`,
    'trashed = false',
    `'${parentId ?? 'root'}' in parents`,
  ].join(' and ')
  const list = await req(token, `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`)
  const { files } = (await list.json()) as { files?: { id: string }[] }
  if (files?.length) return files[0].id
  const created = await req(token, `${API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined }),
  })
  return ((await created.json()) as { id: string }).id
}

export async function listSessionFiles(token: string): Promise<RemoteFile[]> {
  const q = `appProperties has { key='wlog' and value='1' } and trashed = false`
  const out: RemoteFile[] = []
  let pageToken = ''
  do {
    const url =
      `${API}/files?q=${encodeURIComponent(q)}` +
      `&fields=${encodeURIComponent('nextPageToken,files(id,name,appProperties,parents)')}` +
      `&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`
    const r = await req(token, url)
    const j = (await r.json()) as {
      nextPageToken?: string
      files?: { id: string; name: string; appProperties?: Record<string, string>; parents?: string[] }[]
    }
    for (const f of j.files ?? []) {
      const sessionId = f.appProperties?.sessionId
      if (sessionId) out.push({ id: f.id, name: f.name, sessionId, parents: f.parents ?? [] })
    }
    pageToken = j.nextPageToken ?? ''
  } while (pageToken)
  return out
}

export async function uploadCsv(
  token: string,
  name: string,
  parentId: string,
  csv: string,
  sessionId: string,
): Promise<string> {
  const meta = {
    name,
    parents: [parentId],
    mimeType: 'text/csv',
    appProperties: { wlog: '1', sessionId },
  }
  const boundary = `wlog-${sessionId}`
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n${csv}\r\n--${boundary}--`
  const r = await req(token, `${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return ((await r.json()) as { id: string }).id
}

export async function downloadCsv(token: string, fileId: string): Promise<string> {
  const r = await req(token, `${API}/files/${fileId}?alt=media`)
  return r.text()
}
