import { useLiveQuery } from 'dexie-react-hooks'
import { nav } from '../../app'
import { db } from '../../db/db'
import type { Routine } from '../../db/types'
import { discardSession, startSession } from '../../domain/session'
import { useProfile } from '../../hooks/useProfile'
import { fmtDate } from '../format'
import { InstallHint } from '../components/InstallHint'
import { SyncBadge } from '../components/SyncBadge'
import { Tabs } from '../components/Tabs'

export function PickWorkout() {
  const profile = useProfile()
  const routines = useLiveQuery(() => db.routines.orderBy('name').toArray(), [])
  const inProgress = useLiveQuery(() => db.sessions.where('status').equals('in_progress').first(), [])
  const completed = useLiveQuery(() => db.sessions.where('status').equals('completed').toArray(), [])

  if (!routines || completed === undefined) return null

  const lastByRoutine = new Map<string, { date: string; count: number }>()
  for (const s of completed) {
    const cur = lastByRoutine.get(s.routineId)
    if (!cur || s.date > cur.date) lastByRoutine.set(s.routineId, { date: s.date, count: s.exercises.length })
  }

  const start = async (r: Routine) => {
    const s = await startSession(r)
    nav(`/session/${s.id}`)
  }

  return (
    <>
      <div class="appbar">
        <button class="backbtn" aria-label="Settings" onClick={() => nav('/settings')}>
          ⚙
        </button>
        <span class="title">Workouts</span>
        <SyncBadge />
        {profile && <span class="sub">{profile.name}</span>}
      </div>
      <div class="content">
        <InstallHint />
        {inProgress && (
          <div class="banner">
            <div class="t">⚠ {inProgress.routineName} — in progress</div>
            <div class="m">started {fmtDate(inProgress.date)}</div>
            <div class="acts">
              <button class="btn primary" style="flex:1" onClick={() => nav(`/session/${inProgress.id}`)}>
                Resume
              </button>
              <button
                class="btn"
                style="flex:1"
                onClick={async () => {
                  if (confirm('Discard this workout? Its data will be lost.')) await discardSession(inProgress.id)
                }}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {routines.length === 0 && (
          <div class="empty">
            <div class="big">No routines yet</div>
            Create your first routine — its exercises seed your first workout, and after that each workout starts from
            a copy of the previous one.
          </div>
        )}

        {routines.map((r) => {
          const last = lastByRoutine.get(r.id)
          const blocked = !!inProgress && inProgress.routineId !== r.id
          return (
            <div class="rtcard">
              <button
                class="hit"
                disabled={blocked}
                onClick={() => (inProgress?.routineId === r.id ? nav(`/session/${inProgress.id}`) : start(r))}
              >
                <div class="row1">
                  <span>{r.name}</span>
                </div>
                <div class="meta">
                  {last
                    ? `last done ${fmtDate(last.date)} · ${last.count} exercises`
                    : `never done · ${r.seedExercises.length} exercises`}
                  {blocked && ' — finish or discard the workout in progress first'}
                </div>
              </button>
              <button class="edit" aria-label={`Edit ${r.name}`} onClick={() => nav(`/routine/${r.id}`)}>
                ✎
              </button>
            </div>
          )
        })}

        <button class="btn quiet" onClick={() => nav('/routine/new')}>
          ＋ New routine
        </button>
      </div>
      <Tabs active="home" />
    </>
  )
}
