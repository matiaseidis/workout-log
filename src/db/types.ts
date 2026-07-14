/** First-run profile; single row in the settings table. */
export interface Profile {
  key: 'profile'
  name: string
}

export interface SeedExercise {
  name: string
  targetSets: number
  targetReps: number
  startWeight: number
}

export interface Routine {
  id: string
  name: string
  /** Frozen at creation — becomes the Drive folder name, rename-proof. */
  slug: string
  /** Used only for the first-ever session; afterwards copy-forward takes over. */
  seedExercises: SeedExercise[]
  createdAt: string
}

export interface WorkoutSet {
  reps: number
  weight: number // kg
  done: boolean
}

export interface SessionExercise {
  name: string // denormalized — sessions are self-contained snapshots
  sets: WorkoutSet[]
}

export type SessionStatus = 'in_progress' | 'completed'
export type SyncState = 'local_only' | 'synced'

export interface Session {
  id: string
  routineId: string
  routineName: string
  routineSlug: string
  /** Local calendar date at start, YYYY-MM-DD. */
  date: string
  startedAt: string
  completedAt: string | null
  status: SessionStatus
  exercises: SessionExercise[]
  syncState: SyncState
  driveFileId?: string
  syncedAt?: string
}
