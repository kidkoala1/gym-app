import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '../../lib/errors'
import { readLocal, removeLocal, storeLocal } from '../../lib/storage'
import {
  createWorkout,
  deleteWorkout,
  finishWorkout as finishWorkoutApi,
  getUnfinishedWorkout,
  getWorkoutWithSets,
  saveWorkoutEdit,
  updateWorkoutTitle,
} from './api'
import { resolveCanonicalExerciseName } from './defaultExercises'
import { exerciseInsightsQuery } from './exerciseQueries'
import { useInvalidateWorkoutData } from './invalidate'
import { createLiveWorkoutStore } from './liveWorkoutStore'
import { normalizeWorkoutTitle } from './setInput'
import {
  addExercise as addDraftExercise,
  completedSets,
  draftFromServer,
  formatWeight,
  parseSetValues,
  prefillFirstWeight,
  removeExercise as removeDraftExercise,
  removeSet,
  renameExercise,
  updateSetField,
  visibleExercises,
  type DraftWorkout,
} from './workoutDraft'

const REST_CLOCK_KEY = 'restClockSince'

export type WorkoutSummary = {
  title: string
  startedAt: string
  durationMin: number
  exerciseCount: number
  setCount: number
  volumeKg: number
}

type Options = {
  user: User | null
  exerciseNames: string[]
  createExerciseAsync: (name: string) => Promise<unknown>
  showError: (message: string) => void
}

/**
 * The workout in progress. Sets save themselves shortly after they are filled in (see
 * liveWorkoutStore), an unfinished workout is resumed on load, and the rest clock restarts whenever
 * a new set is completed.
 */
export function useActiveWorkout({ user, exerciseNames, createExerciseAsync, showError }: Options) {
  const queryClient = useQueryClient()
  const invalidateWorkoutData = useInvalidateWorkoutData(user?.id)

  const [workout, setWorkout] = useState<DraftWorkout | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [resumePending, setResumePending] = useState(true)
  const [restSince, setRestSince] = useState<number | null>(() => Number(readLocal(REST_CLOCK_KEY)) || null)

  const [store] = useState(() =>
    createLiveWorkoutStore({
      save: saveWorkoutEdit,
      onChange: setWorkout,
      onSyncError: setSyncError,
      // History, progress and the exercise list now include the new sets. Weight suggestions
      // leave the live workout out, so they don't need a refresh.
      onSaved: () => {
        void queryClient.invalidateQueries({ queryKey: ['workout-history'] })
        void queryClient.invalidateQueries({ queryKey: ['exercise-progress'] })
        void queryClient.invalidateQueries({ queryKey: ['logged-exercise-names'] })
      },
    }),
  )

  // Resume a workout that was started but never finished (e.g. the app was closed mid-session).
  // Rows that were typed but not saved yet come back from this device's copy.
  const resumeCheckedForUserRef = useRef<string | null>(null)
  useEffect(() => {
    const userId = user?.id
    if (!userId || resumeCheckedForUserRef.current === userId) return
    resumeCheckedForUserRef.current = userId
    store.attach(userId)

    getUnfinishedWorkout(userId)
      .then((server) => {
        if (store.get()) return
        if (!server) {
          store.replace(null)
          return
        }
        const saved = store.readSavedDraft()
        if (saved && saved.id === server.id) {
          store.replace(saved)
          void store.flush()
        } else {
          store.replace(draftFromServer(server))
        }
      })
      .catch(() => {
        resumeCheckedForUserRef.current = null
      })
      .finally(() => setResumePending(false))
  }, [user?.id, store])

  // iOS may close the app at any time once it is in the background, so save right away.
  useEffect(() => {
    const saveNow = () => {
      if (document.visibilityState === 'hidden') void store.flush()
    }
    document.addEventListener('visibilitychange', saveNow)
    window.addEventListener('pagehide', saveNow)
    return () => {
      document.removeEventListener('visibilitychange', saveNow)
      window.removeEventListener('pagehide', saveNow)
    }
  }, [store])

  const startWorkoutMutation = useMutation({
    mutationFn: async (title: string | null) => {
      if (!user) throw new Error('You need to be signed in.')
      return createWorkout(user.id, new Date().toISOString(), title)
    },
  })

  const finishWorkoutMutation = useMutation({
    mutationFn: async (current: DraftWorkout) => {
      if (!user) throw new Error('You need to be signed in.')
      return finishWorkoutApi(current.id, user.id, new Date().toISOString(), current.title)
    },
    onSuccess: invalidateWorkoutData,
  })

  const deleteWorkoutMutation = useMutation({
    mutationFn: async (workoutId: string) => {
      if (!user) throw new Error('You need to be signed in.')
      return deleteWorkout(workoutId, user.id)
    },
    onSuccess: invalidateWorkoutData,
  })

  function restartRestClock() {
    const now = Date.now()
    setRestSince(now)
    storeLocal(REST_CLOCK_KEY, String(now))
  }

  function clearRestClock() {
    setRestSince(null)
    removeLocal(REST_CLOCK_KEY)
  }

  function endWorkout() {
    store.replace(null)
    setSyncError(null)
    clearRestClock()
  }

  /** Clears everything tied to the signed-in user (used on sign-out). */
  function resetActiveWorkout() {
    resumeCheckedForUserRef.current = null
    store.attach(null)
    store.replace(null)
    clearRestClock()
    setResumePending(true)
  }

  async function startWorkout(titleInput: string) {
    try {
      const created = await startWorkoutMutation.mutateAsync(normalizeWorkoutTitle(titleInput))
      store.replace({ id: created.id, startedAt: created.started_at, title: created.title, exercises: [] })
      clearRestClock()
    } catch (error) {
      showError(getErrorMessage(error, 'Could not start workout.'))
    }
  }

  async function renameWorkout(titleInput: string) {
    const current = store.get()
    if (!current || !user) return
    const title = normalizeWorkoutTitle(titleInput)
    store.replace({ ...current, title })
    try {
      await updateWorkoutTitle(current.id, user.id, title)
    } catch (error) {
      showError(getErrorMessage(error, 'Could not rename the workout.'))
    }
  }

  async function rememberExerciseName(name: string) {
    if (exerciseNames.some((existing) => existing.toLowerCase() === name.toLowerCase())) return
    try {
      await createExerciseAsync(name)
    } catch (error) {
      // Another device may have added it already; anything else is worth reporting.
      if ((error as { code?: string | null }).code !== '23505') {
        showError(getErrorMessage(error, 'Could not add the exercise to your list.'))
      }
    }
  }

  async function addExercise(rawName: string) {
    const current = store.get()
    const name = resolveCanonicalExerciseName(rawName, exerciseNames).trim()
    if (!current || !user || !name) return

    const { workout: next, key } = addDraftExercise(current, name)
    store.replace(next)
    void rememberExerciseName(name)

    // The first set starts at last session's weight once that is known.
    try {
      const insights = await queryClient.fetchQuery(exerciseInsightsQuery(user.id, name, current.id))
      const weight = insights?.lastSession?.weightKg
      if (weight !== undefined && store.get()) store.replace(prefillFirstWeight(store.get()!, key, formatWeight(weight)))
    } catch {
      // Suggestions are optional; the user can type the weight.
    }
  }

  function swapExercise(exKey: string, rawName: string) {
    const name = resolveCanonicalExerciseName(rawName, exerciseNames).trim()
    if (!name) return
    store.update((w) => renameExercise(w, exKey, name))
    void rememberExerciseName(name)
  }

  function removeExercise(exKey: string) {
    store.update((w) => removeDraftExercise(w, exKey))
  }

  function updateSet(exKey: string, setKey: string, field: 'weight' | 'reps', value: string) {
    const findSet = () => store.get()?.exercises.find((e) => e.key === exKey)?.sets.find((s) => s.key === setKey)
    const before = findSet()
    store.update((w) => updateSetField(w, exKey, setKey, field, value))
    const after = findSet()

    // A newly finished set (not a correction of a saved one) restarts the rest clock.
    const wasComplete = before ? parseSetValues(before.weight, before.reps) !== null : false
    const isComplete = after ? parseSetValues(after.weight, after.reps) !== null : false
    if (!wasComplete && isComplete && !after?.saved) restartRestClock()
  }

  function deleteSet(exKey: string, setKey: string) {
    store.update((w) => removeSet(w, exKey, setKey))
  }

  /** Saves pending sets now (when a field loses focus). */
  function saveNow() {
    void store.flush()
  }

  /** Returns a summary, 'empty' when nothing was logged, or null when finishing failed. */
  async function finishWorkout(): Promise<WorkoutSummary | 'empty' | null> {
    if (!store.get()) return null
    if (!(await store.flush())) {
      showError('Some sets are not saved yet. Check your connection and try again.')
      return null
    }

    const current = store.get()!
    const exercises = visibleExercises(current)
      .map((exercise) => completedSets(exercise))
      .filter((sets) => sets.length > 0)
    if (exercises.length === 0) return 'empty'

    try {
      await finishWorkoutMutation.mutateAsync(current)
    } catch (error) {
      showError(getErrorMessage(error, 'Could not finish workout.'))
      return null
    }

    endWorkout()
    const sets = exercises.flat()
    return {
      title: current.title || 'Workout',
      startedAt: current.startedAt,
      durationMin: Math.max(1, Math.round((Date.now() - new Date(current.startedAt).getTime()) / 60_000)),
      exerciseCount: exercises.length,
      setCount: sets.length,
      volumeKg: sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0),
    }
  }

  async function deleteActiveWorkout(): Promise<boolean> {
    const current = store.get()
    if (!current) return false
    try {
      await deleteWorkoutMutation.mutateAsync(current.id)
      endWorkout()
      return true
    } catch (error) {
      showError(getErrorMessage(error, 'Could not delete workout.'))
      return false
    }
  }

  /** After the live workout was edited in History: take the database's version. */
  async function reloadFromServer(workoutId: string) {
    if (!user || store.get()?.id !== workoutId) return
    await store.flush()
    try {
      const row = await getWorkoutWithSets(workoutId, user.id)
      store.replace(row ? draftFromServer(row) : null)
    } catch (error) {
      showError(getErrorMessage(error, 'Could not reload the workout.'))
    }
  }

  /** After the live workout was deleted from History. */
  function forgetWorkout(workoutId: string) {
    if (store.get()?.id === workoutId) endWorkout()
  }

  return {
    workout,
    resumePending: resumePending && !workout,
    syncError,
    restSince,
    startWorkout,
    startWorkoutPending: startWorkoutMutation.isPending,
    renameWorkout,
    addExercise,
    swapExercise,
    removeExercise,
    updateSet,
    deleteSet,
    saveNow,
    finishWorkout,
    finishWorkoutPending: finishWorkoutMutation.isPending,
    deleteActiveWorkout,
    deleteWorkoutPending: deleteWorkoutMutation.isPending,
    dismissRestClock: clearRestClock,
    reloadFromServer,
    forgetWorkout,
    resetActiveWorkout,
  }
}
