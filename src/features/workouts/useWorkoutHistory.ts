import { useMemo, useState, type MouseEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { getErrorMessage } from '../../lib/errors'
import { supabase } from '../../lib/supabase'
import { deleteWorkout, listWorkoutHistoryPage, saveWorkoutEdit as saveWorkoutEditApi } from './api'
import type { WorkoutEditExercise } from './api'
import { HISTORY_PAGE_SIZE } from './constants'
import { resolveCanonicalExerciseName } from './defaultExercises'
import { useInvalidateWorkoutData } from './invalidate'
import type { EditableHistoryExercise, SetDraft } from './localTypes'
import {
  MAX_REPS,
  MAX_WEIGHT_KG,
  applySetDraftChange,
  createInitialSetDraft,
  isValidSetValues,
  parseLocalizedDecimal,
} from './setInput'

type Options = {
  user: User | null
  /** True while the History tab is showing; history is only fetched then. */
  isHistoryTabActive: boolean
  exerciseNames: string[]
  createExerciseAsync: (name: string) => Promise<unknown>
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

/** Paged workout history, the row menu, and editing/deleting past workouts. */
export function useWorkoutHistory({
  user,
  isHistoryTabActive,
  exerciseNames,
  createExerciseAsync,
  showError,
  showSuccess,
}: Options) {
  const invalidateWorkoutData = useInvalidateWorkoutData(user?.id)

  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({})
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null)
  const [historyEdits, setHistoryEdits] = useState<Record<string, EditableHistoryExercise[]>>({})
  const [editingExerciseNameInput, setEditingExerciseNameInput] = useState('')
  const [editingSetDrafts, setEditingSetDrafts] = useState<SetDraft[]>(createInitialSetDraft())
  const [workoutMenuAnchor, setWorkoutMenuAnchor] = useState<HTMLElement | null>(null)
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null)

  const historyQuery = useInfiniteQuery({
    queryKey: ['workout-history', user?.id],
    queryFn: ({ pageParam }) => listWorkoutHistoryPage(user!.id, pageParam, HISTORY_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length : undefined),
    enabled: Boolean(user?.id) && isHistoryTabActive,
  })
  // Offset pages can overlap if a workout is added while paging, so de-duplicate by id.
  const historyWorkouts = useMemo(() => {
    const seen = new Set<string>()
    return (historyQuery.data?.pages ?? [])
      .flatMap((page) => page.workouts)
      .filter((workout) => (seen.has(workout.id) ? false : (seen.add(workout.id), true)))
  }, [historyQuery.data])
  const historyErrorMessage = historyQuery.isError
    ? getErrorMessage(historyQuery.error, 'Could not load workout history.')
    : null

  const deleteWorkoutMutation = useMutation({
    mutationFn: async (workoutId: string) => {
      if (!user) throw new Error('You need to be signed in.')
      return deleteWorkout(workoutId, user.id)
    },
    onSuccess: invalidateWorkoutData,
  })

  function buildEditableExercises(workoutId: string): EditableHistoryExercise[] {
    const workout = historyWorkouts.find((item) => item.id === workoutId)
    if (!workout) return []

    return [...(workout.workout_exercises ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        id: exercise.id,
        exercise_name: exercise.exercise_name,
        sets: [...(exercise.workout_sets ?? [])]
          .sort((a, b) => a.set_number - b.set_number)
          .map((set) => ({
            id: set.id,
            set_number: set.set_number,
            reps: String(set.reps),
            weight_kg: String(set.weight_kg),
          })),
      }))
  }

  function toggleExpanded(workoutId: string) {
    setExpandedHistory((prev) => ({ ...prev, [workoutId]: !prev[workoutId] }))
  }

  function openWorkoutMenu(event: MouseEvent<HTMLElement>, workoutId: string) {
    setWorkoutMenuAnchor(event.currentTarget)
    setSelectedWorkoutId(workoutId)
  }

  function closeWorkoutMenu() {
    setWorkoutMenuAnchor(null)
    setSelectedWorkoutId(null)
  }

  function clearEditDrafts() {
    setEditingExerciseNameInput('')
    setEditingSetDrafts(createInitialSetDraft())
  }

  function discardEdits(workoutId: string) {
    setHistoryEdits((prev) => {
      const next = { ...prev }
      delete next[workoutId]
      return next
    })
  }

  function beginWorkoutEdit(workoutId: string) {
    setHistoryEdits((prev) => ({
      ...prev,
      [workoutId]: prev[workoutId] ?? buildEditableExercises(workoutId),
    }))
    setEditingWorkoutId(workoutId)
    setExpandedHistory((prev) => ({ ...prev, [workoutId]: true }))
    clearEditDrafts()
    closeWorkoutMenu()
  }

  function cancelWorkoutEdit() {
    if (!editingWorkoutId) return
    discardEdits(editingWorkoutId)
    setEditingWorkoutId(null)
    clearEditDrafts()
  }

  async function removeWorkoutFromHistory(workoutId: string) {
    closeWorkoutMenu()
    if (!window.confirm('Delete this entire workout? This cannot be undone.')) return

    try {
      await deleteWorkoutMutation.mutateAsync(workoutId)
      if (editingWorkoutId === workoutId) setEditingWorkoutId(null)
      discardEdits(workoutId)
      showSuccess('Workout deleted.')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not delete workout.')
    }
  }

  function markHistoryExerciseDeleted(workoutId: string, exerciseId: string) {
    setHistoryEdits((prev) => ({
      ...prev,
      [workoutId]: (prev[workoutId] ?? []).map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, deleted: true } : exercise,
      ),
    }))
  }

  function updateHistoryExerciseName(workoutId: string, exerciseId: string, value: string) {
    setHistoryEdits((prev) => ({
      ...prev,
      [workoutId]: (prev[workoutId] ?? []).map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, exercise_name: value } : exercise,
      ),
    }))
  }

  function updateHistorySetField(
    workoutId: string,
    exerciseId: string,
    setId: string,
    field: 'reps' | 'weight_kg',
    value: string,
  ) {
    setHistoryEdits((prev) => ({
      ...prev,
      [workoutId]: (prev[workoutId] ?? []).map((exercise) => {
        if (exercise.id !== exerciseId) return exercise
        return {
          ...exercise,
          sets: exercise.sets.map((set) => (set.id === setId ? { ...set, [field]: value } : set)),
        }
      }),
    }))
  }

  function updateEditingSetDraft(index: number, field: keyof SetDraft, value: string) {
    setEditingSetDrafts((prev) => applySetDraftChange(prev, index, field, value))
  }

  function normalizeEditingExerciseName() {
    setEditingExerciseNameInput((prev) => resolveCanonicalExerciseName(prev, exerciseNames))
  }

  function addExerciseToHistoryEdit(workoutId: string) {
    const cleanedName = resolveCanonicalExerciseName(editingExerciseNameInput, exerciseNames).trim()
    if (!cleanedName) return

    const completedSets = editingSetDrafts
      .filter((set) => set.reps.trim() !== '' && set.weight.trim() !== '')
      .map((set, index) => ({
        id: `temp-${Date.now()}-${index}`,
        set_number: index + 1,
        reps: String(set.reps),
        weight_kg: String(set.weight),
      }))
      .filter((set) => isValidSetValues(Number(set.reps), parseLocalizedDecimal(set.weight_kg)))

    if (completedSets.length === 0) return

    const newExercise: EditableHistoryExercise = {
      id: `temp-${Date.now()}`,
      exercise_name: cleanedName,
      sets: completedSets,
      isNew: true,
    }

    setHistoryEdits((prev) => ({
      ...prev,
      [workoutId]: [...(prev[workoutId] ?? []), newExercise],
    }))

    clearEditDrafts()
  }

  async function saveWorkoutEdit(workoutId: string) {
    const draft = historyEdits[workoutId]
    if (!draft) return

    try {
      // Refresh auth session before making database changes
      const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession()
      if (sessionError || !sessionData.session) {
        throw new Error('Authentication session expired. Please refresh and try again.')
      }

      const originalNames = new Map(
        historyWorkouts
          .find((item) => item.id === workoutId)
          ?.workout_exercises.map((exercise) => [exercise.id, exercise.exercise_name.trim()] as const) ?? [],
      )

      const payload: WorkoutEditExercise[] = []
      const newLibraryNames: string[] = []

      for (const exercise of draft) {
        if (exercise.deleted) {
          // Exercises added during this edit only exist locally; nothing to delete in the database.
          if (!exercise.isNew) payload.push({ id: exercise.id, deleted: true })
          continue
        }

        const cleanedName = resolveCanonicalExerciseName(exercise.exercise_name, exerciseNames).trim()
        if (!cleanedName) throw new Error('Exercise title cannot be empty.')

        if (exercise.isNew) {
          payload.push({
            name: cleanedName,
            sets: exercise.sets
              .filter((set) => isValidSetValues(Number(set.reps), parseLocalizedDecimal(set.weight_kg)))
              .map((set) => ({ reps: Number(set.reps), weight_kg: parseLocalizedDecimal(set.weight_kg) })),
          })

          if (!exerciseNames.some((name) => name.toLowerCase() === cleanedName.toLowerCase())) {
            newLibraryNames.push(cleanedName)
          }
        } else {
          payload.push({
            id: exercise.id,
            // Only touch the stored name if the user changed it
            name: exercise.exercise_name.trim() !== originalNames.get(exercise.id) ? cleanedName : undefined,
            sets: exercise.sets.map((set) => {
              const reps = Number(set.reps)
              const weight = parseLocalizedDecimal(set.weight_kg)

              if (!Number.isInteger(reps) || reps <= 0 || reps > MAX_REPS) {
                throw new Error(`Reps must be a whole number between 1 and ${MAX_REPS}.`)
              }
              if (!Number.isFinite(weight) || weight < 0 || weight > MAX_WEIGHT_KG) {
                throw new Error(`Weight must be between 0 and ${MAX_WEIGHT_KG} kg.`)
              }

              return { id: set.id, reps, weight_kg: weight }
            }),
          })
        }
      }

      // One transaction: either the whole edit is saved or the workout is left untouched.
      await saveWorkoutEditApi(workoutId, payload)

      // Best-effort: remember new exercise names in the user's library (the edit is already saved).
      for (const name of newLibraryNames) {
        await createExerciseAsync(name).catch(() => undefined)
      }

      await invalidateWorkoutData()
      setEditingWorkoutId(null)
      discardEdits(workoutId)
      clearEditDrafts()
      showSuccess('Workout updated.')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not update workout.')
    }
  }

  return {
    // list
    isLoading: historyQuery.isLoading,
    workouts: historyWorkouts,
    hasMore: Boolean(historyQuery.hasNextPage),
    isLoadingMore: historyQuery.isFetchingNextPage,
    loadMore: () => void historyQuery.fetchNextPage(),
    errorMessage: historyErrorMessage,
    // editing state
    expandedHistory,
    editingWorkoutId,
    historyEdits,
    editingExerciseNameInput,
    setEditingExerciseNameInput,
    editingSetDrafts,
    // row menu
    workoutMenuAnchor,
    selectedWorkoutId,
    openWorkoutMenu,
    closeWorkoutMenu,
    // actions
    toggleExpanded,
    beginWorkoutEdit,
    cancelWorkoutEdit,
    removeWorkoutFromHistory,
    markHistoryExerciseDeleted,
    updateHistoryExerciseName,
    updateHistorySetField,
    updateEditingSetDraft,
    normalizeEditingExerciseName,
    addExerciseToHistoryEdit,
    cancelAddingExerciseToHistory: clearEditDrafts,
    saveWorkoutEdit,
  }
}
