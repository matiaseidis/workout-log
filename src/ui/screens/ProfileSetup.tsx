import { useState } from 'preact/hooks'
import { saveProfile } from '../../db/db'

/** First-run setup — everything stays on this device. */
export function ProfileSetup() {
  const [name, setName] = useState('')
  const save = async () => {
    if (name.trim()) await saveProfile(name)
  }
  return (
    <>
      <div class="setup-hero">
        <div class="logo" aria-hidden="true">
          🏋️
        </div>
        <h1>Workout Log</h1>
        <p>Track your workouts, set by set. Everything is stored on this device — no account needed.</p>
      </div>
      <div class="content">
        <div class="field">
          <label for="pname">Your name</label>
          <input
            id="pname"
            value={name}
            placeholder="e.g. Ana"
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
          />
        </div>
        <p class="note">Weights are tracked in kg.</p>
      </div>
      <div class="footer-cta">
        <button class="btn primary block" disabled={!name.trim()} onClick={save}>
          Get started
        </button>
      </div>
    </>
  )
}
