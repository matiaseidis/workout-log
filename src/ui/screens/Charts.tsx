import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'preact/hooks'
import { db } from '../../db/db'
import { LineChart } from '../components/LineChart'
import { Tabs } from '../components/Tabs'
import { fmtDate } from '../format'
import { routineOptions } from './History'

export function Charts() {
  const routines = useLiveQuery(() => db.routines.toArray(), [])
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('completed').toArray(), [])
  const [selRoutine, setSelRoutine] = useState<string | null>(null)
  const [selExercise, setSelExercise] = useState<string | null>(null)

  if (!routines || !sessions) return null

  const options = routineOptions(sessions, routines)
  const routineId = selRoutine ?? options[0]?.id
  const routineSessions = sessions
    .filter((s) => s.routineId === routineId)
    .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))

  const exercises = [...new Set(routineSessions.flatMap((s) => s.exercises.map((e) => e.name)))]
  const exercise = selExercise && exercises.includes(selExercise) ? selExercise : exercises[0]

  const pts = routineSessions.flatMap((s) => {
    const e = s.exercises.find((ex) => ex.name === exercise)
    return e ? [{ label: fmtDate(s.date), value: Math.max(...e.sets.map((st) => st.weight)) }] : []
  })

  return (
    <>
      <div class="appbar">
        <span class="title">Progress</span>
      </div>
      <div class="content">
        {options.length === 0 ? (
          <div class="empty">
            <div class="big">Nothing to chart yet</div>
            Complete a few workouts and your progress per exercise appears here.
          </div>
        ) : (
          <>
            <div class="selectrow">
              <select aria-label="Routine" value={routineId} onChange={(e) => {
                setSelRoutine((e.currentTarget as HTMLSelectElement).value)
                setSelExercise(null)
              }}>
                {options.map((o) => (
                  <option value={o.id}>{o.name}</option>
                ))}
              </select>
              <select aria-label="Exercise" value={exercise} onChange={(e) => setSelExercise((e.currentTarget as HTMLSelectElement).value)}>
                {exercises.map((n) => (
                  <option value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div class="chartbox">
              <div class="cap">{exercise ?? '—'} — top set weight (kg)</div>
              <LineChart pts={pts} />
            </div>
            <p class="note">One point per completed workout: the heaviest set of that exercise on the day.</p>
          </>
        )}
      </div>
      <Tabs active="charts" />
    </>
  )
}
