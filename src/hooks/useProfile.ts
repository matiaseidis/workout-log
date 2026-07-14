import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Profile } from '../db/types'

/** undefined = still loading, null = no profile yet (first run). */
export function useProfile(): Profile | null | undefined {
  return useLiveQuery(async () => (await db.settings.get('profile')) ?? null, [])
}
