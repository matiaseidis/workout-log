import { useEffect, useState } from 'preact/hooks'

export type SyncStatus =
  | { kind: 'disconnected' }
  | { kind: 'syncing' }
  | { kind: 'synced' }
  | { kind: 'pending'; count: number }
  | { kind: 'needs_reconnect' }

let current: SyncStatus = { kind: 'disconnected' }
const listeners = new Set<() => void>()

export function setSyncStatus(s: SyncStatus) {
  current = s
  listeners.forEach((l) => l())
}

export function getSyncStatus(): SyncStatus {
  return current
}

export function useSyncStatus(): SyncStatus {
  const [s, set] = useState(current)
  useEffect(() => {
    const l = () => set(getSyncStatus())
    listeners.add(l)
    l()
    return () => {
      listeners.delete(l)
    }
  }, [])
  return s
}
