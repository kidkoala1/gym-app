import type { ExerciseInsightHistoryRow, WorkoutHistoryRow } from '../../types/db'
import type { ExerciseInsightSet, ExerciseWeightInsights } from './localTypes'

const RECENT_BEST_WINDOW_DAYS = 60

export function compareSetsByStrength(left: ExerciseInsightSet, right: ExerciseInsightSet): number {
  if (left.weightKg !== right.weightKg) return left.weightKg - right.weightKg
  if (left.reps !== right.reps) return left.reps - right.reps
  return new Date(left.performedAt).getTime() - new Date(right.performedAt).getTime()
}

export function pickTopSetInSession(
  sets: Array<{ reps: number; weight_kg: number }>,
  performedAt: string,
): ExerciseInsightSet | null {
  const normalized = sets
    .filter((set) => Number.isFinite(set.reps) && Number.isFinite(set.weight_kg))
    .filter((set) => set.reps > 0 && set.weight_kg >= 0)
    .map((set) => ({ reps: set.reps, weightKg: set.weight_kg, performedAt }))

  if (normalized.length === 0) return null

  return normalized.reduce((best, current) =>
    compareSetsByStrength(current, best) > 0 ? current : best,
  )
}

/**
 * Weight suggestions for an exercise: the top set of the most recent session (workouts must be
 * newest first), and the best set within the last 60 days.
 */
export function buildExerciseInsightsFromWorkouts(
  workouts: Array<Pick<WorkoutHistoryRow | ExerciseInsightHistoryRow, 'started_at' | 'workout_exercises'>>,
  canonicalTargetName: string,
): ExerciseWeightInsights | null {
  if (!canonicalTargetName) return null
  const targetName = canonicalTargetName.toLowerCase()

  let lastSession: ExerciseInsightSet | null = null
  let recentBest: ExerciseInsightSet | null = null
  const cutoffMs = Date.now() - RECENT_BEST_WINDOW_DAYS * 24 * 60 * 60 * 1000

  for (const workout of workouts) {
    const matchingExercises = (workout.workout_exercises ?? []).filter(
      (exercise) => exercise.canonical_exercise_name?.toLowerCase() === targetName,
    )
    if (matchingExercises.length === 0) continue

    const topSet = pickTopSetInSession(
      matchingExercises.flatMap((exercise) => exercise.workout_sets ?? []),
      workout.started_at,
    )
    if (!topSet) continue

    if (!lastSession) {
      lastSession = topSet
    }

    const workoutTime = new Date(workout.started_at).getTime()
    if (Number.isFinite(workoutTime) && workoutTime >= cutoffMs) {
      if (!recentBest || compareSetsByStrength(topSet, recentBest) > 0) {
        recentBest = topSet
      }
    }
  }

  return {
    suggestedToday: lastSession ?? recentBest,
    lastSession,
    recentBest,
  }
}
