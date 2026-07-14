import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import type { Routine, Session } from '../db/types'
import {
  addExercise,
  addSet,
  buildNextSession,
  finalizeSession,
  latestCompleted,
  localDate,
  markDone,
  removeExercise,
  startSession,
  updateSet,
} from './session'
import { slugify, uniqueSlug } from './slug'

const routine: Routine = {
  id: 'r1',
  name: 'Push Day',
  slug: 'push-day',
  seedExercises: [
    { name: 'Bench Press', targetSets: 3, targetReps: 8, startWeight: 60 },
    { name: 'Overhead Press', targetSets: 2, targetReps: 10, startWeight: 30 },
  ],
  createdAt: '2026-07-01T10:00:00.000Z',
}

describe('slugify', () => {
  it('normalizes names to drive-safe slugs', () => {
    expect(slugify('Push Day')).toBe('push-day')
    expect(slugify('Día de Piernas!')).toBe('dia-de-piernas')
    expect(slugify('   ')).toBe('routine')
  })
  it('uniquifies against existing slugs', () => {
    expect(uniqueSlug('Push Day', new Set(['push-day']))).toBe('push-day-2')
    expect(uniqueSlug('Push Day', new Set(['push-day', 'push-day-2']))).toBe('push-day-3')
  })
})

describe('buildNextSession', () => {
  it('seeds the first-ever session from the routine', () => {
    const s = buildNextSession(routine, undefined, new Date(2026, 6, 14, 18, 0))
    expect(s.status).toBe('in_progress')
    expect(s.date).toBe('2026-07-14')
    expect(s.exercises).toHaveLength(2)
    expect(s.exercises[0].sets).toHaveLength(3)
    expect(s.exercises[0].sets[0]).toEqual({ reps: 8, weight: 60, done: false })
    expect(s.exercises[1].sets).toHaveLength(2)
    expect(s.syncState).toBe('local_only')
  })

  it('copies forward from the base with done flags reset, without sharing state', () => {
    const base = buildNextSession(routine, undefined, new Date(2026, 6, 10))
    base.exercises[0].sets[0] = { reps: 5, weight: 65, done: true }
    const next = buildNextSession(routine, base, new Date(2026, 6, 14))
    expect(next.exercises[0].sets[0]).toEqual({ reps: 5, weight: 65, done: false })
    next.exercises[0].sets[0].weight = 100
    expect(base.exercises[0].sets[0].weight).toBe(65) // deep copy
  })
})

describe('finalizeSession', () => {
  it('drops undone sets and empty exercises, freezes the rest', () => {
    let s = buildNextSession(routine, undefined, new Date(2026, 6, 14))
    s = updateSet(0, 0, { done: true })(s)
    s = updateSet(0, 1, { done: true })(s)
    // exercise 1: nothing done -> should disappear
    const done = finalizeSession(s, new Date(2026, 6, 14, 19))
    expect(done.status).toBe('completed')
    expect(done.completedAt).not.toBeNull()
    expect(done.exercises).toHaveLength(1)
    expect(done.exercises[0].sets).toHaveLength(2)
    expect(done.syncState).toBe('local_only')
  })
})

describe('session mutations', () => {
  it('addSet clones the last set, addExercise/removeExercise adjust the list', () => {
    let s = buildNextSession(routine, undefined, new Date())
    s = addSet(0)(s)
    expect(s.exercises[0].sets).toHaveLength(4)
    expect(s.exercises[0].sets[3]).toEqual({ reps: 8, weight: 60, done: false })
    s = addExercise('Cable Fly')(s)
    expect(s.exercises[2].name).toBe('Cable Fly')
    s = removeExercise(0)(s)
    expect(s.exercises.map((e) => e.name)).toEqual(['Overhead Press', 'Cable Fly'])
  })
})

describe('db lifecycle', () => {
  beforeEach(async () => {
    await db.sessions.clear()
    await db.routines.clear()
    await db.routines.add(routine)
  })

  it('startSession enforces the single in-progress invariant', async () => {
    const a = await startSession(routine)
    const b = await startSession(routine)
    expect(b.id).toBe(a.id)
  })

  it('completed sessions are immutable and copy-forward includes added exercises', async () => {
    const s = await startSession(routine)
    let cur = s as Session
    cur = updateSet(0, 0, { done: true, weight: 62.5 })(cur)
    cur = addExercise('Triceps Pushdown')(cur)
    cur = updateSet(2, 0, { done: true })(cur)
    await db.sessions.put(cur)

    const done = await markDone(s.id)
    expect(done!.status).toBe('completed')

    // immutability: markDone again is a no-op
    const again = await markDone(s.id)
    expect(again!.completedAt).toBe(done!.completedAt)

    // copy-forward: next session starts from what was actually done
    const latest = await latestCompleted(routine.id)
    expect(latest!.id).toBe(s.id)
    const next = await startSession(routine)
    expect(next.id).not.toBe(s.id)
    expect(next.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Triceps Pushdown'])
    expect(next.exercises[0].sets[0]).toEqual({ reps: 8, weight: 62.5, done: false })
  })

  it('localDate uses the local calendar day', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
