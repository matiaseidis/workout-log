import Dexie, { type Table } from 'dexie'
import type { Profile, Routine, Session } from './types'

export class AppDB extends Dexie {
  routines!: Table<Routine, string>
  sessions!: Table<Session, string>
  settings!: Table<Profile, string>

  constructor() {
    super('workout-log')
    this.version(1).stores({
      routines: 'id, name, slug',
      sessions: 'id, routineId, status, syncState, completedAt, [routineId+status+completedAt]',
      settings: 'key',
    })
  }
}

export const db = new AppDB()

export async function getProfile(): Promise<Profile | undefined> {
  return db.settings.get('profile')
}

export async function saveProfile(name: string): Promise<void> {
  await db.settings.put({ key: 'profile', name: name.trim() })
}
