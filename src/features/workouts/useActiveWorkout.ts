import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  createWorkout,
  deleteWorkout,
  finishWorkout as finishWorkoutApi,
  getCanonicalExerciseName,
  getUnfinishedWorkout,
  listExerciseInsightHistory,
  saveWorkoutEdit as saveWorkoutEditApi,
} from './api'
import { resolveCanonicalExerciseName } from './defaultExercises'
import { buildExerciseInsightsFromWorkouts } from './insights'
import { useInvalidateWorkoutData } from './invalidate'
import type { ActiveWorkout, ExerciseWeightInsights, SetDraft } from './localTypes'
import {
  applySetDraftChange,
  createInitialSetDraft,
  isValidSetValues,
  normalizeWorkoutTitle,
  parseLocalizedDecimal,
} from './setInput'

type Options = {
  user: User | null
  /** True while the Workout tab is showing; weight suggestions are only fetched then. */
  isWorkoutTabActive: boolean
  exerciseNames: string[]
  createExerciseAsync: (name: string) => Promise<unknown>
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

/** The workout in progress: its exercises, the add-exercise form, weight suggestions and resume. */
export function useActiveWorkout({
  user,
  isWorkoutTabActive,
  exerciseNames,
  createExerciseAsync,
  showError,
  showSuccess,
}: Options) {
  const invalidateWorkoutData = useInvalidateWorkoutData(user?.id)

  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null)
  const [isAddingExercise, setIsAddingExercise] = useState(false)
  const [exerciseNameInput, setExerciseNameInput] = useState('')
  const [workoutTitleInput, setWorkoutTitleInput] = useState('')
  const [setDrafts, setSetDrafts] = useState<SetDraft[]>(createInitialSetDraft())
  const [cancelWorkoutConfirmOpen, setCancelWorkoutConfirmOpen] = useState(false)

  // The canonical name comes from the database so grouping rules live in one place.
  const [debouncedExerciseName, setDebouncedExerciseName] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedExerciseName(exerciseNameInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [exerciseNameInput])

  const canonicalNameQuery = useQuery({
    queryKey: ['canonical-exercise-name', debouncedExerciseName],
    queryFn: () => getCanonicalExerciseName(debouncedExerciseName),
    enabled: Boolean(user?.id) && isAddingExercise && debouncedExerciseName.length > 0,
    staleTime: 5 * 60 * 1000,
  })
  const canonicalExerciseInsightName = canonicalNameQuery.data ?? ''

  const exerciseInsightsQuery = useQuery({
    queryKey: ['exercise-insights', user?.id, canonicalExerciseInsightName],
    queryFn: () => listExerciseInsightHistory(user!.id, canonicalExerciseInsightName),
    enabled:
      Boolean(user?.id) &&
      isWorkoutTabActive &&
      isAddingExercise &&
      canonicalExerciseInsightName.length > 0,
  })

  const exerciseInsights = useMemo<ExerciseWeightInsights | null>(() => {
    return buildExerciseInsightsFromWorkouts(exerciseInsightsQuery.data ?? [], canonicalExerciseInsightName)
  }, [canonicalExerciseInsightName, exerciseInsightsQuery.data])

  // Resume a workout that was started but never finished (e.g. the app was closed mid-session).
  const resumeCheckedForUserRef = useRef<string | null>(null)
  useEffect(() => {
    const userId = user?.id
    if (!userId || resumeCheckedForUserRef.current === userId) return
    resumeCheckedForUserRef.current = userId

    getUnfinishedWorkout(userId)
      .then((workout) => {
        if (!workout) return
        const exercises = [...workout.workout_exercises]
          .sort((a, b) => a.position - b.position)
          .map((exercise) => ({
            name: exercise.exercise_name,
            sets: [...exercise.workout_sets]
              .sort((a, b) => a.set_number - b.set_number)
              .map((set) => ({ reps: Number(set.reps), weightKg: Number(set.weight_kg) })),
          }))

        setActiveWorkout(
          (prev) => prev ?? { id: workout.id, startedAt: workout.started_at, title: workout.title, exercises },
        )
        setWorkoutTitleInput((prev) => prev || workout.title || '')
      })
      .catch(() => {
        resumeCheckedForUserRef.current = null
      })
  }, [user?.id])

  const startWorkoutMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You need to be signed in.')
      return createWorkout(user.id, new Date().toISOString(), normalizeWorkoutTitle(workoutTitleInput))
    },
  })

  const finishWorkoutMutation = useMutation({
    mutationFn: async (payload: { workoutId: string }) => {
      if (!user) throw new Error('You need to be signed in.')
      return finishWorkoutApi(
        payload.workoutId,
        user.id,
        new Date().toISOString(),
        normalizeWorkoutTitle(workoutTitleInput),
      )
    },
    onSuccess: invalidateWorkoutData,
  })

  const cancelWorkoutMutation = useMutation({
    mutationFn: async (workoutId: string) => {
      if (!user) throw new Error('You need to be signed in.')
      return deleteWorkout(workoutId, user.id)
    },
    onSuccess: invalidateWorkoutData,
  })

  function resetWorkoutForm() {
    setIsAddingExercise(false)
    setExerciseNameInput('')
    setSetDrafts(createInitialSetDraft())
  }

  /** Clears everything tied to the signed-in user (used on sign-out). */
  function resetActiveWorkout() {
    resumeCheckedForUserRef.current = null
    setActiveWorkout(null)
    resetWorkoutForm()
    setWorkoutTitleInput('')
  }

  async function startWorkout() {
    try {
      const workout = await startWorkoutMutation.mutateAsync()
      setActiveWorkout({
        id: workout.id,
        startedAt: workout.started_at,
        title: workout.title,
        exercises: [],
      })
      resetWorkoutForm()
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not start workout.')
    }
  }

  async function finishWorkout() {
    if (!activeWorkout) return

    try {
      await finishWorkoutMutation.mutateAsync({ workoutId: activeWorkout.id })
      setActiveWorkout(null)
      resetWorkoutForm()
      setWorkoutTitleInput('')
      showSuccess('Workout finished and saved.')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not finish workout.')
    }
  }

  async function cancelWorkout() {
    if (!activeWorkout || !user) return

    try {
      await cancelWorkoutMutation.mutateAsync(activeWorkout.id)
      setActiveWorkout(null)
      resetWorkoutForm()
      setWorkoutTitleInput('')
      setCancelWorkoutConfirmOpen(false)
      showSuccess('Workout canceled.')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not cancel workout.')
    }
  }

  function openAddExercise() {
    setIsAddingExercise(true)
    setExerciseNameInput('')
    setSetDrafts(createInitialSetDraft())
  }

  function handleWorkoutTitleInputChange(value: string) {
    setWorkoutTitleInput(value)
    setActiveWorkout((prev) => (prev ? { ...prev, title: normalizeWorkoutTitle(value) } : prev))
  }

  function updateSetDraft(index: number, field: keyof SetDraft, value: string) {
    setSetDrafts((prev) => applySetDraftChange(prev, index, field, value))
  }

  function normalizeExerciseNameInput() {
    setExerciseNameInput((prev) => resolveCanonicalExerciseName(prev, exerciseNames))
  }

  async function finishExercise() {
    if (!activeWorkout || !user) return

    const cleanedName = resolveCanonicalExerciseName(exerciseNameInput, exerciseNames).trim()
    if (!cleanedName) return

    const completedSets = setDrafts
      .filter((set) => set.reps.trim() !== '' && set.weight.trim() !== '')
      .map((set) => ({ reps: Number(set.reps), weightKg: parseLocalizedDecimal(set.weight) }))
      .filter((set) => isValidSetValues(set.reps, set.weightKg))

    if (completedSets.length === 0) return

    try {
      await saveWorkoutEditApi(activeWorkout.id, [
        {
          name: cleanedName,
          sets: completedSets.map((set) => ({ reps: set.reps, weight_kg: set.weightKg })),
        },
      ])

      setActiveWorkout((prev) =>
        prev
          ? { ...prev, exercises: [...prev.exercises, { name: cleanedName, sets: completedSets }] }
          : prev,
      )

      if (!exerciseNames.some((name) => name.toLowerCase() === cleanedName.toLowerCase())) {
        try {
          await createExerciseAsync(cleanedName)
        } catch (error) {
          const maybeDuplicate = error as Error & { code?: string | null }
          if (maybeDuplicate.code !== '23505') throw error
        }
      }

      await invalidateWorkoutData()
      resetWorkoutForm()
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not save exercise.')
    }
  }

  return {
    activeWorkout,
    isAddingExercise,
    exerciseNameInput,
    setExerciseNameInput,
    workoutTitleInput,
    setDrafts,
    exerciseInsights,
    exerciseInsightsLoading: exerciseInsightsQuery.isLoading,
    startWorkoutPending: startWorkoutMutation.isPending,
    finishWorkoutPending: finishWorkoutMutation.isPending,
    cancelWorkoutPending: cancelWorkoutMutation.isPending,
    cancelWorkoutConfirmOpen,
    setCancelWorkoutConfirmOpen,
    startWorkout,
    finishWorkout,
    cancelWorkout,
    openAddExercise,
    cancelAddExercise: resetWorkoutForm,
    finishExercise,
    handleWorkoutTitleInputChange,
    normalizeExerciseNameInput,
    updateSetDraft,
    resetActiveWorkout,
  }
}
