import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** Refreshes everything derived from workouts after a workout, exercise or set changes. */
export function useInvalidateWorkoutData(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['workout-history', userId] })
    await queryClient.invalidateQueries({ queryKey: ['exercise-progress'] })
    await queryClient.invalidateQueries({ queryKey: ['exercise-insights'] })
    await queryClient.invalidateQueries({ queryKey: ['logged-exercise-names', userId] })
  }, [queryClient, userId])
}
