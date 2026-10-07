import { useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { getErrorMessage } from '../../lib/errors'
import { deleteWorkout, listWorkoutHistoryPage, saveWorkoutEdit, updateWorkoutTitle } from './api'
import { HISTORY_PAGE_SIZE } from './constants'
import { resolveCanonicalExerciseName } from './defaultExercises'
import { useInvalidateWorkoutData } from './invalidate'
import { normalizeWorkoutTitle } from './setInput'
import {
  addExercise as addDraftExercise,
  buildSyncRequest,
  draftFromServer,
  removeExercise as removeDraftExercise,
  removeSet,
  renameExercise as renameDraftExercise,
  updateSetField,
  visibleExercises,
  type DraftWorkout,
} from './workoutDraft'

type Options = {
  user: User | null
  /** True while the History tab is showing; history is only fetched then. */
  isHistoryTabActive: boolean
  exerciseNames: string[]
  createExerciseAsync: (name: string) => Promise<unknown>
  showError: (message: string) => void
  showSuccess: (message: string) => void
  /** Called after a workout was saved or deleted, so the live workout can reload if it was that one. */
  onWorkoutSaved: (workoutId: string) => void
  onWorkoutDeleted: (workoutId: string) => void
}

export type HistoryEdit = { draft: DraftWorkout; titleInput: string }

/** Paged workout history, the detail sheet, and editing or deleting past workouts. */
export function useWorkoutHistory({
  user,
  isHistoryTabActive,
  exerciseNames,
  createExerciseAsync,
  showError,
  showSuccess,
  onWorkoutSaved,
  onWorkoutDeleted,
}: Options) {
  const invalidateWorkoutData = useInvalidateWorkoutData(user?.id)

  const [openWorkoutId, setOpenWorkoutId] = useState<string | null>(null)
  const [edit, setEdit] = useState<HistoryEdit | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

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

  const openWorkout = historyWorkouts.find((workout) => workout.id === openWorkoutId) ?? null
  const deleteTarget = historyWorkouts.find((workout) => workout.id === deleteTargetId) ?? null

  const deleteWorkoutMutation = useMutation({
    mutationFn: async (workoutId: string) => {
      if (!user) throw new Error('You need to be signed in.')
      return deleteWorkout(workoutId, user.id)
    },
    onSuccess: invalidateWorkoutData,
  })

  function openDetail(workoutId: string) {
    setOpenWorkoutId(workoutId)
    setEdit(null)
  }

  function closeDetail() {
    setOpenWorkoutId(null)
    setEdit(null)
  }

  function beginEdit() {
    if (!openWorkout) return
    setEdit({ draft: draftFromServer(openWorkout), titleInput: openWorkout.title ?? '' })
  }

  function changeDraft(change: (draft: DraftWorkout) => DraftWorkout) {
    setEdit((prev) => (prev ? { ...prev, draft: change(prev.draft) } : prev))
  }

  async function saveEdit() {
    if (!edit || !user || !openWorkout) return
    const { draft, titleInput } = edit
    const exercises = visibleExercises(draft)
    if (exercises.some((exercise) => !exercise.name.trim())) {
      showError('Every exercise needs a name.')
      return
    }

    // Typed names are resolved the same way as in the live workout ("ohp" becomes Overhead Press).
    const resolved = exercises.reduce(
      (d, exercise) => renameDraftExercise(d, exercise.key, resolveCanonicalExerciseName(exercise.name, exerciseNames)),
      draft,
    )
    const { payload } = buildSyncRequest(resolved)
    const title = normalizeWorkoutTitle(titleInput)

    setIsSaving(true)
    try {
      // One transaction for the exercises and sets: either all of it is saved or nothing.
      if (payload.length > 0) await saveWorkoutEdit(draft.id, payload)
      if (title !== (openWorkout.title?.trim() || null)) await updateWorkoutTitle(draft.id, user.id, title)

      // Best effort: remember new exercise names in the user's list (the edit is already saved).
      for (const exercise of visibleExercises(resolved)) {
        const name = exercise.name.trim()
        if (!exerciseNames.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
          await createExerciseAsync(name).catch(() => undefined)
        }
      }

      await invalidateWorkoutData()
      setEdit(null)
      showSuccess('Workout updated.')
      onWorkoutSaved(draft.id)
    } catch (error) {
      showError(getErrorMessage(error, 'Could not update workout.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTargetId) return
    const workoutId = deleteTargetId
    setDeleteTargetId(null)
    try {
      await deleteWorkoutMutation.mutateAsync(workoutId)
      if (openWorkoutId === workoutId) closeDetail()
      showSuccess('Workout deleted.')
      onWorkoutDeleted(workoutId)
    } catch (error) {
      showError(getErrorMessage(error, 'Could not delete workout.'))
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
    // detail sheet
    openWorkout,
    openDetail,
    closeDetail,
    // editing
    edit,
    isSaving,
    beginEdit,
    cancelEdit: () => setEdit(null),
    setTitleInput: (value: string) => setEdit((prev) => (prev ? { ...prev, titleInput: value } : prev)),
    updateSet: (exKey: string, setKey: string, field: 'weight' | 'reps', value: string) =>
      changeDraft((d) => updateSetField(d, exKey, setKey, field, value)),
    deleteSet: (exKey: string, setKey: string) => changeDraft((d) => removeSet(d, exKey, setKey)),
    renameExercise: (exKey: string, name: string) => changeDraft((d) => renameDraftExercise(d, exKey, name)),
    removeExercise: (exKey: string) => changeDraft((d) => removeDraftExercise(d, exKey)),
    addExercise: (rawName: string) => {
      const name = resolveCanonicalExerciseName(rawName, exerciseNames).trim()
      if (name) changeDraft((d) => addDraftExercise(d, name).workout)
    },
    saveEdit,
    // deleting
    deleteTarget,
    requestDelete: setDeleteTargetId,
    cancelDelete: () => setDeleteTargetId(null),
    confirmDelete,
    deletePending: deleteWorkoutMutation.isPending,
  }
}
