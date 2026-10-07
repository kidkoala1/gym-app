import { readLocal, removeLocal, storeLocal } from '../../lib/storage'
import type { WorkoutEditExercise, WorkoutEditResult } from './api'
import { applySyncResult, buildSyncRequest, type DraftWorkout } from './workoutDraft'

const SAVE_DELAY_MS = 1000
const RETRY_DELAY_MS = 5000

type Options = {
  save: (workoutId: string, payload: WorkoutEditExercise[]) => Promise<WorkoutEditResult>
  onChange: (workout: DraftWorkout | null) => void
  onSyncError: (message: string | null) => void
  onSaved: () => void
}

export type LiveWorkoutStore = ReturnType<typeof createLiveWorkoutStore>

/**
 * Holds the live workout outside React so saves run strictly one after another: each save works
 * out what is still unsaved at the moment it starts, so a set is never sent twice even when the
 * user keeps typing while a save is running. The workout is also kept in localStorage, so rows that
 * were typed but not saved yet survive the app being closed.
 */
export function createLiveWorkoutStore({ save, onChange, onSyncError, onSaved }: Options) {
  let current: DraftWorkout | null = null
  let storageKey: string | null = null
  let chain: Promise<unknown> = Promise.resolve()
  let timer: ReturnType<typeof setTimeout> | undefined

  function set(next: DraftWorkout | null) {
    current = next
    if (storageKey) {
      if (next) storeLocal(storageKey, JSON.stringify(next))
      else removeLocal(storageKey)
    }
    onChange(next)
  }

  function run(): Promise<boolean> {
    const result = chain.then(async () => {
      const workout = current
      if (!workout) return true
      const { payload, plan } = buildSyncRequest(workout)
      if (payload.length === 0) return true

      try {
        const saved = await save(workout.id, payload)
        if (current && current.id === workout.id) set(applySyncResult(current, plan, saved))
        onSyncError(null)
        onSaved()
        return true
      } catch (error) {
        onSyncError(error instanceof Error && error.message ? error.message : 'Could not save.')
        schedule(RETRY_DELAY_MS)
        return false
      }
    })
    chain = result.catch(() => false)
    return result
  }

  function schedule(delay = SAVE_DELAY_MS) {
    clearTimeout(timer)
    timer = setTimeout(() => void run(), delay)
  }

  return {
    get: () => current,

    /** Points storage at a user's saved draft; nothing is loaded or saved. */
    attach(userId: string | null) {
      clearTimeout(timer)
      storageKey = userId ? `liveWorkout:${userId}` : null
    },

    readSavedDraft(): DraftWorkout | null {
      if (!storageKey) return null
      try {
        const parsed = JSON.parse(readLocal(storageKey) || 'null') as DraftWorkout | null
        return parsed && typeof parsed.id === 'string' && Array.isArray(parsed.exercises) ? parsed : null
      } catch {
        return null
      }
    },

    /** Replaces the workout without saving (it came from the database, or the workout ended). */
    replace(next: DraftWorkout | null) {
      clearTimeout(timer)
      set(next)
    },

    /** Applies an edit and saves it shortly after typing stops. */
    update(edit: (workout: DraftWorkout) => DraftWorkout) {
      if (!current) return
      set(edit(current))
      schedule()
    },

    /** Saves everything now. Resolves false when the save failed. */
    flush(): Promise<boolean> {
      clearTimeout(timer)
      return run()
    },
  }
}
