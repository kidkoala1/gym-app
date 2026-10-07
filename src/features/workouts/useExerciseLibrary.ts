import { useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ExerciseRow } from '../../types/db'
import { createExercise, deleteExercise, listExercises } from './api'
import { DEFAULT_EXERCISE_NAMES, resolveCanonicalExerciseName } from './defaultExercises'

/** The user's custom exercise list merged with the built-in names, plus add/delete actions. */
export function useExerciseLibrary(user: User | null, showError: (message: string) => void) {
  const queryClient = useQueryClient()

  const [newExerciseInput, setNewExerciseInput] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ExerciseRow | null>(null)

  const exercisesQuery = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: () => listExercises(user!.id),
    enabled: Boolean(user?.id),
  })

  const exerciseLibrary = useMemo(() => exercisesQuery.data ?? [], [exercisesQuery.data])
  const exerciseNames = useMemo(() => {
    const merged = new Set<string>(DEFAULT_EXERCISE_NAMES.map((name) => name.toLowerCase()))
    const names: string[] = [...DEFAULT_EXERCISE_NAMES]

    exerciseLibrary.forEach((exercise) => {
      const key = exercise.name.toLowerCase()
      if (!merged.has(key)) {
        merged.add(key)
        names.push(exercise.name)
      }
    })

    return names.sort((a, b) => a.localeCompare(b))
  }, [exerciseLibrary])

  const createExerciseMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('You need to be signed in.')
      return createExercise(user.id, name)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises', user?.id] })
    },
  })

  const deleteExerciseMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      if (!user) throw new Error('You need to be signed in.')
      return deleteExercise(exerciseId, user.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercises', user?.id] })
    },
  })

  async function addExerciseToLibrary() {
    const value = resolveCanonicalExerciseName(newExerciseInput, exerciseNames).trim()
    if (!value) return

    try {
      await createExerciseMutation.mutateAsync(value)
      setNewExerciseInput('')
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not add exercise.')
    }
  }

  async function confirmDeleteExercise() {
    if (!deleteTarget) return
    try {
      await deleteExerciseMutation.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not delete exercise.')
    }
  }

  return {
    exerciseLibrary,
    exerciseNames,
    exercisesLoading: exercisesQuery.isLoading,
    createExerciseAsync: createExerciseMutation.mutateAsync,
    createExercisePending: createExerciseMutation.isPending,
    deleteExercisePending: deleteExerciseMutation.isPending,
    newExerciseInput,
    setNewExerciseInput,
    deleteTarget,
    setDeleteTarget,
    addExerciseToLibrary,
    confirmDeleteExercise,
  }
}
