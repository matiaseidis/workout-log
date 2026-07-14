import { db } from '../db/db'
import type { Session } from '../db/types'
import { csvToSession, sessionToCsv } from '../domain/csv'
import { getAccessToken, invalidateToken, isConnected, setConnected } from './auth'
import { DriveAuthError, downloadCsv, ensureFolder, listSessionFiles, uploadCsv, type RemoteFile } from './drive'
import { setSyncStatus } from './status'

export const ROOT_FOLDER = 'WorkoutTracker'

/* ------------------------------------------------------------------ */
/* Pure planner: set difference on sessionId, both directions.         */
/* Uploads = local completed sessions Drive doesn't have (append-only  */
/* write-once files); downloads = remote files this device lacks       */
/* (device replacement / restore path).                                */
/* ------------------------------------------------------------------ */
export interface SyncPlan {
  uploadIds: string[]
  downloads: RemoteFile[]
}

export function planSync(localCompleted: Pick<Session, 'id'>[], remote: RemoteFile[]): SyncPlan {
  const localIds = new Set(localCompleted.map((s) => s.id))
  const remoteIds = new Set(remote.map((r) => r.sessionId))
  return {
    uploadIds: localCompleted.filter((s) => !remoteIds.has(s.id)).map((s) => s.id),
    downloads: remote.filter((r) => !localIds.has(r.sessionId)),
  }
}

/** date.csv, date_2.csv, ... against names already taken in the folder. */
export function uniqueCsvName(date: string, taken: Set<string>): string {
  const base = `${date}.csv`
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${date}_${n}.csv`
    if (!taken.has(candidate)) return candidate
  }
}

/* ------------------------------------------------------------------ */
/* Runner: single-flight; per-file failures are skipped and simply     */
/* retried on the next trigger because the plan is recomputed from     */
/* state. In-progress sessions never sync. Never blocks the UI.        */
/* ------------------------------------------------------------------ */
let running = false
let queued = false

export async function requestSync(): Promise<void> {
  if (!isConnected()) {
    setSyncStatus({ kind: 'disconnected' })
    return
  }
  if (running) {
    queued = true
    return
  }
  running = true
  try {
    await doSync(false)
  } finally {
    running = false
    if (queued) {
      queued = false
      void requestSync()
    }
  }
}

/** Interactive variants — must be called from a user gesture. */
export async function connectAndSync(): Promise<void> {
  await getAccessToken(true) // throws if the user closes the consent popup
  setConnected(true)
  await requestSync()
}
export async function reconnectAndSync(): Promise<void> {
  invalidateToken()
  await getAccessToken(true)
  await requestSync()
}
export function disconnect(): void {
  setConnected(false)
  setSyncStatus({ kind: 'disconnected' })
}

async function doSync(interactive: boolean): Promise<void> {
  setSyncStatus({ kind: 'syncing' })
  let token: string
  try {
    token = await getAccessToken(interactive)
  } catch {
    setSyncStatus({ kind: 'needs_reconnect' })
    return
  }
  try {
    const remote = await listSessionFiles(token)
    const localCompleted = await db.sessions.where('status').equals('completed').toArray()
    const plan = planSync(localCompleted, remote)

    // Repair pass: local sessions Drive already has are just flagged synced.
    const remoteBySession = new Map(remote.map((r) => [r.sessionId, r]))
    for (const s of localCompleted) {
      const rf = remoteBySession.get(s.id)
      if (s.syncState === 'local_only' && rf) {
        await db.sessions.update(s.id, { syncState: 'synced', driveFileId: rf.id, syncedAt: new Date().toISOString() })
      }
    }

    if (plan.uploadIds.length > 0) {
      const rootId = await ensureFolder(token, ROOT_FOLDER)
      const bySession = new Map(localCompleted.map((s) => [s.id, s]))
      const folderIds = new Map<string, string>() // slug -> folderId
      const takenNames = new Map<string, Set<string>>() // folderId -> filenames
      for (const rf of remote) {
        const parent = rf.parents[0]
        if (parent) (takenNames.get(parent) ?? takenNames.set(parent, new Set()).get(parent)!).add(rf.name)
      }
      for (const id of plan.uploadIds) {
        const s = bySession.get(id)!
        try {
          let folderId = folderIds.get(s.routineSlug)
          if (!folderId) {
            folderId = await ensureFolder(token, s.routineSlug, rootId)
            folderIds.set(s.routineSlug, folderId)
          }
          const taken = takenNames.get(folderId) ?? takenNames.set(folderId, new Set()).get(folderId)!
          const name = uniqueCsvName(s.date, taken)
          taken.add(name)
          const fileId = await uploadCsv(token, name, folderId, sessionToCsv(s), s.id)
          await db.sessions.update(id, { syncState: 'synced', driveFileId: fileId, syncedAt: new Date().toISOString() })
        } catch (e) {
          if (e instanceof DriveAuthError) throw e
          // skipped; retried on the next trigger
        }
      }
    }

    for (const rf of plan.downloads) {
      try {
        const parsed = csvToSession(await downloadCsv(token, rf.id))
        await db.transaction('rw', [db.sessions, db.routines], async () => {
          let routine = await db.routines.where('slug').equals(parsed.routineSlug).first()
          if (!routine) {
            routine = {
              id: crypto.randomUUID(),
              name: parsed.routineName,
              slug: parsed.routineSlug,
              seedExercises: [],
              createdAt: new Date().toISOString(),
            }
            await db.routines.add(routine)
          }
          if (!(await db.sessions.get(parsed.id))) {
            await db.sessions.add({
              ...parsed,
              routineId: routine.id,
              syncState: 'synced',
              driveFileId: rf.id,
              syncedAt: new Date().toISOString(),
            })
          }
        })
      } catch (e) {
        if (e instanceof DriveAuthError) throw e
        // skipped; retried on the next trigger
      }
    }

    await publishStatusFromDb()
  } catch (e) {
    if (e instanceof DriveAuthError) {
      invalidateToken()
      setSyncStatus({ kind: 'needs_reconnect' })
    } else {
      await publishStatusFromDb() // offline or Drive down: calm "N pending"
    }
  }
}

async function publishStatusFromDb(): Promise<void> {
  const pending = await db.sessions
    .where('syncState')
    .equals('local_only')
    .and((s) => s.status === 'completed')
    .count()
  setSyncStatus(pending > 0 ? { kind: 'pending', count: pending } : { kind: 'synced' })
}

/** Wire the passive triggers. The plan is recomputed each run, so this set is also the retry schedule. */
export function initSync(): void {
  if (isConnected()) {
    void publishStatusFromDb()
    setTimeout(() => void requestSync(), 2000) // app launch, after first paint
  } else {
    setSyncStatus({ kind: 'disconnected' })
  }
  addEventListener('online', () => void requestSync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void requestSync()
  })
}
