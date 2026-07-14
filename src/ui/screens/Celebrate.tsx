import { useLiveQuery } from 'dexie-react-hooks'
import { nav } from '../../app'
import { db } from '../../db/db'
import medal1 from '../../assets/medal-1.jpg'
import medal2 from '../../assets/medal-2.jpg'

const CONFETTI_COLORS = ['#2757d6', '#e4b13c', '#1e8e4e', '#c6373c', '#5d87f5', '#f0b35c']

/** Stable per-session photo pick so a given workout always celebrates the same way. */
export function pickMedalPhoto(sessionId: string): string {
  let sum = 0
  for (const ch of sessionId) sum += ch.charCodeAt(0)
  return sum % 2 === 0 ? medal1 : medal2
}

/** Post-workout celebration: gold medal (starring the head of quality control) + confetti. */
export function Celebrate({ id }: { id: string }) {
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  if (session === undefined) return null
  if (!session || session.status !== 'completed') {
    nav('/')
    return null
  }

  return (
    <div class="celebrate">
      <div class="confetti" aria-hidden="true">
        {Array.from({ length: 60 }, (_, i) => (
          <i
            style={`left:${(i * 137.5) % 100}vw;background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};width:${
              6 + (i % 3) * 3
            }px;animation-duration:${(2.6 + (((i * 37) % 100) / 100) * 2.2).toFixed(2)}s;animation-delay:${(
              (((i * 61) % 100) / 100) *
              2.4
            ).toFixed(2)}s`}
          />
        ))}
      </div>
      <div class="rays" aria-hidden="true" />
      <h1>Certified good workout</h1>
      <p class="sub">Approved by the head of quality control.</p>
      <div class="medalwrap">
        <div class="ribbon" />
        <div class="medal">
          <img src={pickMedalPhoto(session.id)} alt="A very good dog awarding you a medal" />
        </div>
      </div>
      <div class="stamp">Inspected · Approved</div>
      <button class="btn primary" onClick={() => nav(`/summary/${id}`)}>
        Continue
      </button>
    </div>
  )
}
