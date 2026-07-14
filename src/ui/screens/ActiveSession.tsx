import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'preact/hooks'
import { nav } from '../../app'
import { db } from '../../db/db'
import {
  addExercise,
  addSet,
  applyMut,
  completedForRoutine,
  markDone,
  removeExercise,
  removeSet,
  renameExercise,
  updateSet,
  type SessionMut,
} from '../../domain/session'
import { useWakeLock } from '../../hooks/useWakeLock'
import { InstNav } from '../components/InstNav'
import { NumberField } from '../components/NumberField'
import { fmtDate } from '../format'

export function ActiveSession({ id }: { id: string }) {
  useWakeLock()
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const completed = useLiveQuery(() => completedForRoutine(session?.routineId), [session?.routineId])

  useEffect(() => {
    if (session?.status === 'completed') nav(`/summary/${id}`)
  }, [session?.status, id])

  if (session === undefined || completed === undefined) return null
  if (!session)
    return (
      <div class="empty">
        <div class="big">Workout not found</div>
        <button class="btn quiet" onClick={() => nav('/')}>
          Back to workouts
        </button>
      </div>
    )
  if (session.status === 'completed') return null // redirecting

  const mut = (m: SessionMut) => applyMut(id, m)
  const prev = completed[completed.length - 1]
  const anyDone = session.exercises.some((e) => e.sets.some((s) => s.done))

  const finish = async () => {
    await markDone(id)
    nav(`/celebrate/${id}`)
  }

  return (
    <>
      <div class="appbar">
        <button class="backbtn" onClick={() => nav('/')}>
          ‹ Back
        </button>
        <span class="title">{session.routineName}</span>
        <span class="sub">Today · {fmtDate(session.date)}</span>
      </div>
      <InstNav onPrev={prev ? () => nav(`/session/${id}/peek/${prev.id}`) : undefined}>
        <b>live session</b>
        {prev ? ` · ◀ ${fmtDate(prev.date)}` : ''}
      </InstNav>
      <div class="content">
        {session.exercises.map((e, ei) => (
          <section class="exercise">
            <div class="head">
              <input
                class="exname"
                value={e.name}
                aria-label="Exercise name"
                onChange={(ev) => {
                  const v = (ev.currentTarget as HTMLInputElement).value.trim()
                  if (v) mut(renameExercise(ei, v))
                }}
              />
              <button
                class="rm"
                aria-label={`Remove ${e.name}`}
                onClick={() => {
                  if (confirm(`Remove ${e.name} from this workout?`)) mut(removeExercise(ei))
                }}
              >
                ✕
              </button>
            </div>
            <div class="sethead">
              <span>set</span>
              <span>reps</span>
              <span>kg</span>
              <span>done</span>
              <span />
            </div>
            {e.sets.map((s, si) => (
              <div class="setrow">
                <span class="n">{si + 1}</span>
                <NumberField value={s.reps} label="reps" onCommit={(v) => mut(updateSet(ei, si, { reps: Math.round(v) }))} />
                <NumberField value={s.weight} decimal label="weight kg" onCommit={(v) => mut(updateSet(ei, si, { weight: v }))} />
                <button
                  class={`check ${s.done ? 'on' : ''}`}
                  aria-label="Set done"
                  aria-pressed={s.done}
                  onClick={() => mut(updateSet(ei, si, { done: !s.done }))}
                >
                  ✓
                </button>
                <button class="setrm" aria-label="Remove set" onClick={() => mut(removeSet(ei, si))}>
                  ✕
                </button>
              </div>
            ))}
            <div class="foot">
              <button class="btn quiet" onClick={() => mut(addSet(ei))}>
                ＋ add set
              </button>
            </div>
          </section>
        ))}
        <button class="btn quiet" onClick={() => mut(addExercise('New exercise'))}>
          ＋ add exercise
        </button>
      </div>
      <div class="footer-cta">
        <button class="btn primary block" disabled={!anyDone} onClick={finish}>
          ✓ Mark workout done
        </button>
      </div>
    </>
  )
}
