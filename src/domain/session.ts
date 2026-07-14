import Dexie from 'dexie'
import { db } from '../db/db'
import type { Routine, Session, SessionExercise } from '../db/types'

export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/* ------------------------------------------------------------------ */
/* Pure core                                                           */
/* ------------------------------------------------------------------ */

/**
 * Build a new in-progress session for a routine. Copy-forward: the base is
 * the latest completed session (all sets reset to not-done); with no base,
 * the routine's seed exercises are used.
 */
export function buildNextSession(routine: Routine, base: Session | undefined, now: Date): Session {
  const exercises: SessionExercise[] = base
    ? base.exercises.map((e) => ({
        name: e.name,
        sets: e.sets.map((s) => ({ reps: s.reps, weight: s.weight, done: false })),
      }))
    : routine.seedExercises.map((se) => ({
        name: se.name,
        sets: Array.from({ length: Math.max(1, se.targetSets) }, () => ({
          reps: se.targetReps,
          weight: se.startWeight,
          done: false,
        })),
      }))
  return {
    id: crypto.randomUUID(),
    routineId: routine.id,
    routineName: routine.name,
    routineSlug: routine.slug,
    date: localDate(now),
    startedAt: now.toISOString(),
    completedAt: null,
    status: 'in_progress',
    exercises,
    syncState: 'local_only',
  }
}

/**
 * Freeze a session: drop sets that were never checked off (and exercises left
 * with no done sets) — what you actually did becomes the next template — then
 * mark completed. After this, only sync fields may ever change.
 */
export function finalizeSession(s: Session, now: Date): Session {
  const exercises = s.exercises
    .map((e) => ({ name: e.name, sets: e.sets.filter((st) => st.done) }))
    .filter((e) => e.sets.length > 0)
  return {
    ...s,
    exercises,
    status: 'completed',
    completedAt: now.toISOString(),
    syncState: 'local_only',
  }
}

export type SessionMut = (s: Session) => Session

export const updateSet =
  (ei: number, si: number, patch: Partial<{ reps: number; weight: number; done: boolean }>): SessionMut =>
  (s) => ({
    ...s,
    exercises: s.exercises.map((e, i) =>
      i !== ei ? e : { ...e, sets: e.sets.map((st, j) => (j !== si ? st : { ...st, ...patch })) },
    ),
  })

export const addSet =
  (ei: number): SessionMut =>
  (s) => ({
    ...s,
    exercises: s.exercises.map((e, i) => {
      if (i !== ei) return e
      const last = e.sets[e.sets.length - 1]
      const clone = last ? { reps: last.reps, weight: last.weight, done: false } : { reps: 8, weight: 0, done: false }
      return { ...e, sets: [...e.sets, clone] }
    }),
  })

export const removeSet =
  (ei: number, si: number): SessionMut =>
  (s) => ({
    ...s,
    exercises: s.exercises.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) })),
  })

export const addExercise =
  (name: string): SessionMut =>
  (s) => ({
    ...s,
    exercises: [...s.exercises, { name, sets: [{ reps: 8, weight: 0, done: false }] }],
  })

export const removeExercise =
  (ei: number): SessionMut =>
  (s) => ({ ...s, exercises: s.exercises.filter((_, i) => i !== ei) })

export const renameExercise =
  (ei: number, name: string): SessionMut =>
  (s) => ({ ...s, exercises: s.exercises.map((e, i) => (i !== ei ? e : { ...e, name })) })

/* ------------------------------------------------------------------ */
/* DB operations                                                       */
/* ------------------------------------------------------------------ */

export async function latestCompleted(routineId: string): Promise<Session | undefined> {
  return db.sessions
    .where('[routineId+status+completedAt]')
    .between([routineId, 'completed', Dexie.minKey], [routineId, 'completed', Dexie.maxKey])
    .last()
}

/** All completed sessions of a routine, oldest -> newest (index order). */
export async function completedForRoutine(routineId: string | undefined): Promise<Session[]> {
  if (!routineId) return []
  return db.sessions
    .where('[routineId+status+completedAt]')
    .between([routineId, 'completed', Dexie.minKey], [routineId, 'completed', Dexie.maxKey])
    .toArray()
}

export async function inProgressSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('in_progress').first()
}

/**
 * Start a session for a routine. Invariant: at most one in-progress session
 * app-wide — if one already exists it is returned instead (resume).
 */
export async function startSession(routine: Routine): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const existing = await inProgressSession()
    if (existing) return existing
    const base = await latestCompleted(routine.id)
    const next = buildNextSession(routine, base, new Date())
    await db.sessions.add(next)
    return next
  })
}

export async function applyMut(id: string, mut: SessionMut): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s || s.status !== 'in_progress') return // completed sessions are immutable
    await db.sessions.put(mut(s))
  })
}

export async function markDone(id: string): Promise<Session | undefined> {
  return db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s || s.status !== 'in_progress') return s
    const done = finalizeSession(s, new Date())
    await db.sessions.put(done)
    return done
  })
}

export async function discardSession(id: string): Promise<void> {
  const s = await db.sessions.get(id)
  if (s?.status === 'in_progress') await db.sessions.delete(id)
}
