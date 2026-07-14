import type { Session } from '../../db/types'

/** Read-only rendering of a frozen session — used by peek, detail and summary. */
export function SessionView({ session }: { session: Session }) {
  return (
    <>
      {session.exercises.map((e) => (
        <section class="exercise">
          <div class="head">
            <span class="name">{e.name}</span>
          </div>
          <div class="ro-list">
            {e.sets.map((s, i) => (
              <div class="ro-set">
                <span class="idx">{i + 1}</span>· {s.reps} × {s.weight} kg
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
