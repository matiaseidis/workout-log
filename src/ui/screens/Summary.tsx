import { useLiveQuery } from 'dexie-react-hooks'
import { nav } from '../../app'
import { db } from '../../db/db'
import { SessionView } from '../components/SessionView'
import { fmtDate, fmtDuration, setCount } from '../format'

export function Summary({ id }: { id: string }) {
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  if (session === undefined) return null
  if (!session || session.status !== 'completed') {
    nav('/')
    return null
  }

  return (
    <>
      <div class="appbar">
        <span class="title">{session.routineName} ✓</span>
        <span class="sub">
          {fmtDate(session.date)} · {fmtDuration(session.startedAt, session.completedAt)}
        </span>
      </div>
      <div class="content">
        <div class="summary-hero">
          <div class="big">
            {session.exercises.length} exercises · {setCount(session.exercises)} sets
          </div>
          <div class="sub">Session is frozen — history is append-only.</div>
        </div>
        <div class="card">
          {session.exercises.map((e) => {
            const top = e.sets.reduce((a, b) => (b.weight > a.weight ? b : a))
            return (
              <div class="statline">
                <span class="k">{e.name}</span>
                <span class="v">
                  {top.reps} × {top.weight} kg top set
                </span>
              </div>
            )
          })}
        </div>
        <SessionView session={session} />
        <p class="note">Saved on this phone. Google Drive sync arrives in the next milestone.</p>
      </div>
      <div class="footer-cta">
        <button class="btn primary block" onClick={() => nav('/')}>
          Back to workouts
        </button>
      </div>
    </>
  )
}
