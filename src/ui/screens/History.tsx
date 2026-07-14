import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'preact/hooks'
import { nav } from '../../app'
import { db } from '../../db/db'
import { Tabs } from '../components/Tabs'
import { fmtDate, setCount } from '../format'

/** Routine options seen in completed sessions ∪ existing routines (covers deleted routines). */
export function routineOptions(
  sessions: { routineId: string; routineName: string }[],
  routines: { id: string; name: string }[],
): { id: string; name: string }[] {
  const map = new Map<string, string>()
  for (const r of routines) map.set(r.id, r.name)
  for (const s of sessions) if (!map.has(s.routineId)) map.set(s.routineId, s.routineName)
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export function History() {
  const routines = useLiveQuery(() => db.routines.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('completed').toArray(), [])
  const [selected, setSelected] = useState<string | null>(null)

  if (!routines || !sessions) return null

  const options = routineOptions(sessions, routines)
  const routineId = selected ?? options[0]?.id
  const rows = sessions
    .filter((s) => s.routineId === routineId)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))

  return (
    <>
      <div class="appbar">
        <span class="title">History</span>
      </div>
      <div class="content">
        {options.length === 0 ? (
          <div class="empty">
            <div class="big">No completed workouts yet</div>
            Finish your first workout and it will show up here, frozen forever.
          </div>
        ) : (
          <>
            <div class="selectrow">
              <select aria-label="Routine" value={routineId} onChange={(e) => setSelected((e.currentTarget as HTMLSelectElement).value)}>
                {options.map((o) => (
                  <option value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            {rows.length === 0 && <p class="note">No completed workouts for this routine yet.</p>}
            {rows.map((s) => (
              <button class="histrow" onClick={() => nav(`/detail/${s.id}`)}>
                <span class="d">{fmtDate(s.date)}</span>
                <span class="m">
                  {s.exercises.length} exercises · {setCount(s.exercises)} sets ›
                </span>
              </button>
            ))}
          </>
        )}
      </div>
      <Tabs active="history" />
    </>
  )
}
