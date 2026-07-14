import type { Session, SessionExercise } from '../db/types'

/**
 * Canonical serialization: one CSV per completed session, one row per set,
 * session metadata repeated on every row so it opens cleanly in Sheets.
 * `sessionToCsv(csvToSession(x)) === x` is a tested invariant — Drive files
 * are a full-fidelity backup. RFC 4180: CRLF line endings, double-quote escaping.
 */
export const CSV_HEADER =
  'session_id,routine,routine_slug,date,started_at,completed_at,exercise_index,exercise,set_index,reps,weight,unit'

function esc(v: string): string {
  return /[",\r\n]/.test(v) ? '"' + v.replaceAll('"', '""') + '"' : v
}

export function sessionToCsv(s: Session): string {
  const lines = [CSV_HEADER]
  s.exercises.forEach((e, ei) => {
    e.sets.forEach((st, si) => {
      lines.push(
        [
          s.id,
          esc(s.routineName),
          s.routineSlug,
          s.date,
          s.startedAt,
          s.completedAt ?? '',
          String(ei + 1),
          esc(e.name),
          String(si + 1),
          String(st.reps),
          String(st.weight),
          'kg',
        ].join(','),
      )
    })
  })
  return lines.join('\r\n') + '\r\n'
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  return rows
}

/**
 * Rebuild a completed Session from its CSV. `routineId` is not stored in the
 * file — the sync engine resolves it by slug on restore; here it is ''.
 */
export function csvToSession(text: string): Session {
  const rows = parseCsv(text)
  const header = rows.shift()
  if (!header || header.join(',') !== CSV_HEADER) throw new Error('Unrecognized workout CSV header')
  if (rows.length === 0) throw new Error('Workout CSV has no set rows')

  const first = rows[0]
  const byExercise = new Map<number, { name: string; sets: { si: number; reps: number; weight: number }[] }>()
  for (const r of rows) {
    if (r.length !== 12) throw new Error(`Malformed workout CSV row: expected 12 fields, got ${r.length}`)
    const ei = Number(r[6])
    const entry = byExercise.get(ei) ?? { name: r[7], sets: [] }
    entry.sets.push({ si: Number(r[8]), reps: Number(r[9]), weight: Number(r[10]) })
    byExercise.set(ei, entry)
  }
  const exercises: SessionExercise[] = [...byExercise.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, e]) => ({
      name: e.name,
      sets: e.sets.sort((a, b) => a.si - b.si).map((st) => ({ reps: st.reps, weight: st.weight, done: true })),
    }))

  return {
    id: first[0],
    routineId: '',
    routineName: first[1],
    routineSlug: first[2],
    date: first[3],
    startedAt: first[4],
    completedAt: first[5] || null,
    status: 'completed',
    exercises,
    syncState: 'synced',
  }
}
