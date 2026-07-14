import { useLiveQuery } from 'dexie-react-hooks'
import { nav } from '../../app'
import { db } from '../../db/db'
import { completedForRoutine } from '../../domain/session'
import { InstNav } from '../components/InstNav'
import { SessionView } from '../components/SessionView'
import { fmtDate } from '../format'

/** Read-only look at a past instance of the workout currently in progress. */
export function Peek({ id, peekId }: { id: string; peekId: string }) {
  const peeked = useLiveQuery(() => db.sessions.get(peekId), [peekId])
  const completed = useLiveQuery(() => completedForRoutine(peeked?.routineId), [peeked?.routineId])

  if (peeked === undefined || completed === undefined) return null
  if (!peeked) {
    nav(`/session/${id}`)
    return null
  }

  const idx = completed.findIndex((s) => s.id === peekId)
  const older = idx > 0 ? completed[idx - 1] : undefined
  const newer = idx >= 0 && idx < completed.length - 1 ? completed[idx + 1] : undefined
  const backToLive = () => nav(`/session/${id}`)

  return (
    <>
      <div class="appbar">
        <button class="backbtn" onClick={backToLive}>
          ‹ Back
        </button>
        <span class="title">{peeked.routineName}</span>
        <span class="sub warn">{fmtDate(peeked.date)} — read only</span>
      </div>
      <InstNav
        warn
        onPrev={older ? () => nav(`/session/${id}/peek/${older.id}`) : undefined}
        onNext={() => (newer ? nav(`/session/${id}/peek/${newer.id}`) : backToLive())}
      >
        <b>{fmtDate(peeked.date)}</b>
        {older ? ` · ◀ ${fmtDate(older.date)}` : ''}
      </InstNav>
      <div class="content">
        <SessionView session={peeked} />
      </div>
      <div class="footer-cta">
        <button class="btn block" onClick={backToLive}>
          ▶ Back to today’s workout
        </button>
      </div>
    </>
  )
}
