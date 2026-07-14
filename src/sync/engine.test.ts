import { describe, expect, it } from 'vitest'
import type { RemoteFile } from './drive'
import { planSync, uniqueCsvName } from './engine'

const rf = (sessionId: string, name = 'x.csv'): RemoteFile => ({ id: `f-${sessionId}`, name, sessionId, parents: ['p'] })

describe('planSync', () => {
  it('fresh Drive: everything local uploads, nothing downloads', () => {
    const plan = planSync([{ id: 'a' }, { id: 'b' }], [])
    expect(plan.uploadIds).toEqual(['a', 'b'])
    expect(plan.downloads).toEqual([])
  })

  it('fresh device: everything remote downloads, nothing uploads', () => {
    const plan = planSync([], [rf('a'), rf('b')])
    expect(plan.uploadIds).toEqual([])
    expect(plan.downloads.map((d) => d.sessionId)).toEqual(['a', 'b'])
  })

  it('partial overlap: strict set difference in both directions', () => {
    const plan = planSync([{ id: 'a' }, { id: 'b' }], [rf('b'), rf('c')])
    expect(plan.uploadIds).toEqual(['a'])
    expect(plan.downloads.map((d) => d.sessionId)).toEqual(['c'])
  })

  it('full overlap: sync is a no-op (append-only steady state)', () => {
    const plan = planSync([{ id: 'a' }], [rf('a')])
    expect(plan.uploadIds).toEqual([])
    expect(plan.downloads).toEqual([])
  })
})

describe('uniqueCsvName', () => {
  it('suffixes on same-day collisions', () => {
    const taken = new Set<string>()
    expect(uniqueCsvName('2026-07-14', taken)).toBe('2026-07-14.csv')
    taken.add('2026-07-14.csv')
    expect(uniqueCsvName('2026-07-14', taken)).toBe('2026-07-14_2.csv')
    taken.add('2026-07-14_2.csv')
    expect(uniqueCsvName('2026-07-14', taken)).toBe('2026-07-14_3.csv')
  })
})
