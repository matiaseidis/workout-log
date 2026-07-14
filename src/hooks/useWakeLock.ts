import { useEffect } from 'preact/hooks'

/** Keep the screen awake while the component is mounted (iOS Safari >= 16.4). */
export function useWakeLock() {
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null
    const acquire = async () => {
      try {
        lock = await (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<any> } }).wakeLock?.request(
          'screen',
        )
      } catch {
        /* unsupported or denied — not worth surfacing */
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      lock?.release().catch(() => {})
    }
  }, [])
}
