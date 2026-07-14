import { nav } from '../../app'
import { reconnectAndSync, requestSync } from '../../sync/engine'
import { useSyncStatus } from '../../sync/status'

/** Small pill in the app bar: calm sync state, never blocking, tap to act. */
export function SyncBadge() {
  const s = useSyncStatus()
  switch (s.kind) {
    case 'disconnected':
      return (
        <button class="pill" onClick={() => nav('/settings')}>
          ☁︎ set up sync
        </button>
      )
    case 'syncing':
      return <span class="pill">☁︎ ⟳ syncing…</span>
    case 'synced':
      return (
        <button class="pill good" onClick={() => void requestSync()}>
          ☁︎ ✓ synced
        </button>
      )
    case 'pending':
      return (
        <button class="pill warn2" onClick={() => void requestSync()}>
          ☁︎ {s.count} pending
        </button>
      )
    case 'needs_reconnect':
      return (
        <button class="pill warn2" onClick={() => void reconnectAndSync().catch(() => {})}>
          ☁︎ reconnect
        </button>
      )
  }
}
