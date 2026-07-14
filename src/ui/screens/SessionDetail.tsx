import { useLiveQuery } from 'dexie-react-hooks'
import { nav } from '../../app'
import { db } from '../../db/db'
import { completedForRoutine } from '../../domain/session'
import { InstNav } from '../components/InstNav'
import { SessionView } from '../components/SessionView'
import { fmtDate, fmtDuration } from '../format'

export function SessionDetail({ id }: { id: string }) {
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const completed = useLiveQuery(() => completedForRoutine(session?.routineId), [session?.routineId])

  if (session === undefined || completed === undefined) return null
  if (!session) {
    nav('/history')
    return null
  }

  const idx = completed.findIndex((s) => s.id === id)
  const older = idx > 0 ? completed[idx - 1] : undefined
  const newer = idx >= 0 && idx < completed.length - 1 ? completed[idx + 1] : undefined

  return (
    <>
      <div class="appbar">
        <button class="backbtn" onClick={() => nav('/history')}>
          ‹ History
        </button>
        <span class="title">{session.routineName}</span>
        <span class="sub">
          {fmtDate(session.date)} · {fmtDuration(session.startedAt, session.completedAt)} · frozen
        </span>
      </div>
      <InstNav
        onPrev={older ? () => nav(`/detail/${older.id}`) : undefined}
        onNext={newer ? () => nav(`/detail/${newer.id}`) : undefined}
      >
        <b>{fmtDate(session.date)}</b>
      </InstNav>
      <div class="content">
        <SessionView session={session} />
      </div>
    </>
  )
}
