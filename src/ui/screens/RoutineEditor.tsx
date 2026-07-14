import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'preact/hooks'
import { nav } from '../../app'
import { db } from '../../db/db'
import type { SeedExercise } from '../../db/types'
import { uniqueSlug } from '../../domain/slug'
import { NumberField } from '../components/NumberField'

const emptyRow = (): SeedExercise => ({ name: '', targetSets: 3, targetReps: 8, startWeight: 0 })

export function RoutineEditor({ id }: { id?: string }) {
  const existing = useLiveQuery(async () => (id ? await db.routines.get(id) : undefined), [id])
  const [name, setName] = useState('')
  const [rows, setRows] = useState<SeedExercise[]>([emptyRow()])
  const [loaded, setLoaded] = useState(false)
  const [hasHistory, setHasHistory] = useState(false)

  useEffect(() => {
    if (id && existing && !loaded) {
      setName(existing.name)
      setRows(existing.seedExercises.length ? existing.seedExercises : [emptyRow()])
      setLoaded(true)
      db.sessions
        .where('routineId')
        .equals(id)
        .count()
        .then((n) => setHasHistory(n > 0))
    }
  }, [id, existing, loaded])

  const patchRow = (i: number, patch: Partial<SeedExercise>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const valid = name.trim().length > 0 && rows.some((r) => r.name.trim())

  const save = async () => {
    const seeds = rows.filter((r) => r.name.trim()).map((r) => ({ ...r, name: r.name.trim() }))
    if (id && existing) {
      await db.routines.put({ ...existing, name: name.trim(), seedExercises: seeds })
    } else {
      const slugs = new Set((await db.routines.toArray()).map((r) => r.slug))
      await db.routines.add({
        id: crypto.randomUUID(),
        name: name.trim(),
        slug: uniqueSlug(name, slugs),
        seedExercises: seeds,
        createdAt: new Date().toISOString(),
      })
    }
    nav('/')
  }

  const remove = async () => {
    if (!id) return
    if (confirm('Delete this routine? Completed workouts stay in your history.')) {
      await db.routines.delete(id)
      nav('/')
    }
  }

  return (
    <>
      <div class="appbar">
        <button class="backbtn" onClick={() => nav('/')}>
          ‹ Back
        </button>
        <span class="title">{id ? 'Edit routine' : 'New routine'}</span>
      </div>
      <div class="content">
        <div class="field">
          <label for="rname">Name</label>
          <input
            id="rname"
            value={name}
            placeholder="e.g. Push Day"
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          />
        </div>

        <div class="field">
          <label>Exercises — first-time template</label>
        </div>
        <div class="seedcap">
          <span>exercise</span>
          <span>sets</span>
          <span>reps</span>
          <span>kg</span>
          <span />
        </div>
        {rows.map((r, i) => (
          <div class="seedrow">
            <input
              class="nm"
              value={r.name}
              placeholder="Exercise name"
              aria-label="Exercise name"
              onInput={(e) => patchRow(i, { name: (e.currentTarget as HTMLInputElement).value })}
            />
            <NumberField value={r.targetSets} label="sets" onCommit={(v) => patchRow(i, { targetSets: Math.max(1, Math.round(v)) })} />
            <NumberField value={r.targetReps} label="reps" onCommit={(v) => patchRow(i, { targetReps: Math.round(v) })} />
            <NumberField value={r.startWeight} decimal label="weight kg" onCommit={(v) => patchRow(i, { startWeight: v })} />
            <button class="del" aria-label="Remove exercise" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
        <button class="btn quiet" onClick={() => setRows([...rows, emptyRow()])}>
          ＋ add exercise
        </button>

        <p class="note">
          {hasHistory
            ? 'ⓘ This routine already has history, so the list above is no longer used: each workout starts from a copy of the previous one.'
            : 'ⓘ Used only for the very first workout of this routine. After that, every workout starts from a copy of the previous one — including any exercises you add or drop along the way.'}
        </p>

        {id && (
          <button class="btn danger-quiet" onClick={remove}>
            Delete routine
          </button>
        )}
      </div>
      <div class="footer-cta">
        <button class="btn primary block" disabled={!valid} onClick={save}>
          Save routine
        </button>
      </div>
    </>
  )
}
