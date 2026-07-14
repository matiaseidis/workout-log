import { describe, expect, it } from 'vitest'
import type { Session } from '../db/types'
import { CSV_HEADER, csvToSession, sessionToCsv } from './csv'

const session: Session = {
  id: '7f3a1c2e-0000-4000-8000-000000000001',
  routineId: 'r1',
  routineName: 'Push Day',
  routineSlug: 'push-day',
  date: '2026-07-14',
  startedAt: '2026-07-14T18:03:11.000Z',
  completedAt: '2026-07-14T18:52:40.000Z',
  status: 'completed',
  exercises: [
    {
      name: 'Bench Press',
      sets: [
        { reps: 8, weight: 60, done: true },
        { reps: 6, weight: 62.5, done: true },
      ],
    },
    { name: 'Overhead Press', sets: [{ reps: 10, weight: 32.5, done: true }] },
  ],
  syncState: 'synced',
}

describe('sessionToCsv / csvToSession', () => {
  it('serializes one row per set with metadata repeated', () => {
    const csv = sessionToCsv(session)
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe(CSV_HEADER)
    expect(lines).toHaveLength(4) // header + 3 sets
    expect(lines[1]).toBe(
      '7f3a1c2e-0000-4000-8000-000000000001,Push Day,push-day,2026-07-14,2026-07-14T18:03:11.000Z,2026-07-14T18:52:40.000Z,1,Bench Press,1,8,60,kg',
    )
    expect(lines[2]).toContain(',62.5,kg')
  })

  it('round-trips exactly: csv -> session -> csv is the identity', () => {
    const csv = sessionToCsv(session)
    expect(sessionToCsv(csvToSession(csv))).toBe(csv)
  })

  it('reconstructs the session shape (all sets done, status completed)', () => {
    const back = csvToSession(sessionToCsv(session))
    expect(back.id).toBe(session.id)
    expect(back.routineSlug).toBe('push-day')
    expect(back.status).toBe('completed')
    expect(back.exercises).toHaveLength(2)
    expect(back.exercises[0].sets).toEqual(session.exercises[0].sets)
    expect(back.routineId).toBe('') // resolved by the sync engine on restore
  })

  it('quotes and round-trips names containing commas, quotes and accents', () => {
    const tricky: Session = {
      ...session,
      routineName: 'Día "fuerte", pesado',
      exercises: [{ name: 'Press, inclinado "pesado"', sets: [{ reps: 5, weight: 7.5, done: true }] }],
    }
    const csv = sessionToCsv(tricky)
    const back = csvToSession(csv)
    expect(back.routineName).toBe('Día "fuerte", pesado')
    expect(back.exercises[0].name).toBe('Press, inclinado "pesado"')
    expect(sessionToCsv(back)).toBe(csv)
  })

  it('rejects foreign CSVs', () => {
    expect(() => csvToSession('a,b,c\r\n1,2,3\r\n')).toThrow(/header/i)
    expect(() => csvToSession(CSV_HEADER + '\r\n')).toThrow(/no set rows/i)
  })
})
