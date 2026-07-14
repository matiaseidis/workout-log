import { useState } from 'preact/hooks'
import { nav } from '../../app'
import { saveProfile } from '../../db/db'
import { clientIdConfigured, isConnected } from '../../sync/auth'
import { connectAndSync, disconnect } from '../../sync/engine'
import { useSyncStatus } from '../../sync/status'
import { useProfile } from '../../hooks/useProfile'

export function Settings() {
  const profile = useProfile()
  const status = useSyncStatus()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const connected = isConnected()

  const connect = async () => {
    setBusy(true)
    setError('')
    try {
      await connectAndSync()
    } catch {
      setError('Google sign-in was cancelled or failed. Nothing changed — you can try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div class="appbar">
        <button class="backbtn" onClick={() => nav('/')}>
          ‹ Back
        </button>
        <span class="title">Settings</span>
      </div>
      <div class="content">
        <div class="field">
          <label for="sname">Your name</label>
          <input
            id="sname"
            value={profile?.name ?? ''}
            onBlur={(e) => {
              const v = (e.currentTarget as HTMLInputElement).value.trim()
              if (v) saveProfile(v)
            }}
          />
        </div>

        <div class="field">
          <label>Google Drive backup</label>
        </div>
        {connected ? (
          <>
            <div class="card">
              <div class="row1">
                <span>Connected</span>
                <span class="chev">
                  {status.kind === 'synced' && '✓ synced'}
                  {status.kind === 'pending' && `${status.count} pending`}
                  {status.kind === 'syncing' && '⟳ syncing…'}
                  {status.kind === 'needs_reconnect' && 'reconnect needed'}
                </span>
              </div>
              <div class="meta">
                Each finished workout is saved as a readable spreadsheet in the “WorkoutTracker” folder of your Drive.
              </div>
            </div>
            <button class="btn danger-quiet" onClick={disconnect}>
              Disconnect Drive
            </button>
            <p class="note">
              Disconnecting stops the backup; everything stays on this phone. Files already in Drive are never touched.
            </p>
          </>
        ) : (
          <>
            <button class="btn primary block" disabled={busy || !clientIdConfigured()} onClick={connect}>
              Connect Google Drive
            </button>
            {!clientIdConfigured() && (
              <p class="note">⚠ Drive sync isn’t available in this build yet (no Google client ID configured).</p>
            )}
            {error && <p class="note">{error}</p>}
            <p class="note">
              Your workouts stay on this phone either way. Connecting adds an automatic backup: every finished workout
              becomes a readable spreadsheet in your own Google Drive — and lets a new phone restore your full history.
              The app can only see files it created (Drive “app folder” permission), nothing else in your Drive.
            </p>
          </>
        )}
      </div>
    </>
  )
}
