import { queryOptions } from '@tanstack/react-query'
import { getCanonicalExerciseName, listExerciseInsightHistory, listWorkoutHistoryPage } from './api'
import { buildExerciseInsightsFromWorkouts } from './insights'

/**
 * "Last time" and "Best in 60 days" for one exercise. The live workout is left out so its own sets
 * never count as "last time".
 */
export function exerciseInsightsQuery(userId: string | undefined, name: string, excludeWorkoutId: string | null) {
  const trimmed = name.trim()
  return queryOptions({
    queryKey: ['exercise-insights', userId, trimmed.toLowerCase(), excludeWorkoutId],
    queryFn: async () => {
      const canonical = await getCanonicalExerciseName(trimmed)
      const rows = await listExerciseInsightHistory(userId!, canonical)
      return buildExerciseInsightsFromWorkouts(
        rows.filter((row) => row.id !== excludeWorkoutId),
        canonical,
      )
    },
    enabled: Boolean(userId) && trimmed.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

export const RECENT_WORKOUTS_COUNT = 20

/** The most recent workouts (newest first), for the week strip, "last workout" and the exercise picker. */
export function recentWorkoutsQuery(userId: string | undefined) {
  return queryOptions({
    // Shares the 'workout-history' prefix so useInvalidateWorkoutData refreshes it too.
    queryKey: ['workout-history', userId, 'recent'],
    queryFn: async () => (await listWorkoutHistoryPage(userId!, 0, RECENT_WORKOUTS_COUNT)).workouts,
    enabled: Boolean(userId),
  })
}
