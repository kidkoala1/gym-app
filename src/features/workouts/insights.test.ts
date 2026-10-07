import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseInsightHistoryRow } from '../../types/db'
import { buildExerciseInsightsFromWorkouts, compareSetsByStrength, pickTopSetInSession } from './insights'
import type { ExerciseInsightSet } from './localTypes'

const NOW = new Date('2026-06-15T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString()
}

type SetInput = [reps: number, weightKg: number]

function exercise(canonicalName: string, sets: SetInput[], id = canonicalName) {
  return {
    id,
    exercise_name: canonicalName,
    canonical_exercise_name: canonicalName,
    position: 1,
    workout_sets: sets.map(([reps, weight_kg], index) => ({
      id: `${id}-set-${index}`,
      set_number: index + 1,
      reps,
      weight_kg,
    })),
  }
}

function workout(
  startedAt: string,
  exercises: ReturnType<typeof exercise>[],
): Pick<ExerciseInsightHistoryRow, 'started_at' | 'workout_exercises'> {
  return { started_at: startedAt, workout_exercises: exercises }
}

describe('compareSetsByStrength', () => {
  const base: ExerciseInsightSet = { reps: 8, weightKg: 60, performedAt: '2026-06-01T10:00:00Z' }

  it('ranks heavier sets higher', () => {
    expect(compareSetsByStrength({ ...base, weightKg: 70 }, base)).toBeGreaterThan(0)
    expect(compareSetsByStrength(base, { ...base, weightKg: 70 })).toBeLessThan(0)
  })

  it('breaks weight ties by reps', () => {
    expect(compareSetsByStrength({ ...base, reps: 10 }, base)).toBeGreaterThan(0)
  })

  it('breaks full ties by the most recent date', () => {
    expect(compareSetsByStrength({ ...base, performedAt: '2026-06-10T10:00:00Z' }, base)).toBeGreaterThan(0)
  })

  it('treats identical sets as equal', () => {
    expect(compareSetsByStrength(base, { ...base })).toBe(0)
  })
})

describe('pickTopSetInSession', () => {
  it('returns null when there are no sets', () => {
    expect(pickTopSetInSession([], daysAgo(1))).toBeNull()
  })

  it('picks the heaviest set', () => {
    const top = pickTopSetInSession(
      [
        { reps: 12, weight_kg: 50 },
        { reps: 6, weight_kg: 70 },
        { reps: 8, weight_kg: 60 },
      ],
      daysAgo(1),
    )
    expect(top).toEqual({ reps: 6, weightKg: 70, performedAt: daysAgo(1) })
  })

  it('prefers more reps at the same weight', () => {
    const top = pickTopSetInSession(
      [
        { reps: 5, weight_kg: 80 },
        { reps: 7, weight_kg: 80 },
      ],
      daysAgo(1),
    )
    expect(top?.reps).toBe(7)
  })

  it('ignores invalid sets', () => {
    const top = pickTopSetInSession(
      [
        { reps: 0, weight_kg: 200 },
        { reps: 5, weight_kg: -10 },
        { reps: Number.NaN, weight_kg: 90 },
        { reps: 8, weight_kg: 40 },
      ],
      daysAgo(1),
    )
    expect(top).toEqual({ reps: 8, weightKg: 40, performedAt: daysAgo(1) })
  })

  it('returns null when every set is invalid', () => {
    expect(pickTopSetInSession([{ reps: 0, weight_kg: 50 }], daysAgo(1))).toBeNull()
  })
})

describe('buildExerciseInsightsFromWorkouts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null without a target exercise', () => {
    expect(buildExerciseInsightsFromWorkouts([], '')).toBeNull()
  })

  it('returns empty insights when the exercise was never logged', () => {
    const result = buildExerciseInsightsFromWorkouts(
      [workout(daysAgo(2), [exercise('Lat Pulldown', [[10, 50]])])],
      'Barbell Bench Press',
    )
    expect(result).toEqual({ suggestedToday: null, lastSession: null, recentBest: null })
  })

  it('uses the most recent session (first in the list) as the last session', () => {
    const result = buildExerciseInsightsFromWorkouts(
      [
        workout(daysAgo(2), [exercise('Barbell Bench Press', [[8, 60], [6, 65]])]),
        workout(daysAgo(9), [exercise('Barbell Bench Press', [[5, 80]])]),
      ],
      'Barbell Bench Press',
    )
    expect(result?.lastSession).toEqual({ reps: 6, weightKg: 65, performedAt: daysAgo(2) })
  })

  it('suggests the last session, even when an older session was heavier', () => {
    const result = buildExerciseInsightsFromWorkouts(
      [
        workout(daysAgo(2), [exercise('Barbell Bench Press', [[8, 60]])]),
        workout(daysAgo(9), [exercise('Barbell Bench Press', [[5, 80]])]),
      ],
      'Barbell Bench Press',
    )
    expect(result?.suggestedToday?.weightKg).toBe(60)
    expect(result?.recentBest?.weightKg).toBe(80)
  })

  it('picks the best set from the last 60 days only', () => {
    const result = buildExerciseInsightsFromWorkouts(
      [
        workout(daysAgo(3), [exercise('Squat', [[5, 100]])]),
        workout(daysAgo(30), [exercise('Squat', [[5, 120]])]),
        workout(daysAgo(90), [exercise('Squat', [[1, 200]])]),
      ],
      'Squat',
    )
    expect(result?.recentBest?.weightKg).toBe(120)
  })

  it('leaves recentBest empty when the only session is older than 60 days', () => {
    const result = buildExerciseInsightsFromWorkouts(
      [workout(daysAgo(100), [exercise('Squat', [[5, 100]])])],
      'Squat',
    )
    expect(result?.lastSession?.weightKg).toBe(100)
    expect(result?.recentBest).toBeNull()
    expect(result?.suggestedToday?.weightKg).toBe(100)
  })

  it('treats a session exactly 60 days ago as recent, and 61 days ago as not', () => {
    const exactly60 = buildExerciseInsightsFromWorkouts(
      [workout(daysAgo(60), [exercise('Squat', [[5, 100]])])],
      'Squat',
    )
    const day61 = buildExerciseInsightsFromWorkouts(
      [workout(daysAgo(61), [exercise('Squat', [[5, 100]])])],
      'Squat',
    )
    expect(exactly60?.recentBest).not.toBeNull()
    expect(day61?.recentBest).toBeNull()
  })

  it('matches the exercise name case-insensitively', () => {
    const result = buildExerciseInsightsFromWorkouts(
      [workout(daysAgo(2), [exercise('Barbell Bench Press', [[8, 60]])])],
      'barbell bench PRESS',
    )
    expect(result?.lastSession?.weightKg).toBe(60)
  })

  it('combines several entries of the same exercise within one workout', () => {
    const result = buildExerciseInsightsFromWorkouts(
      [
        workout(daysAgo(2), [
          exercise('Barbell Bench Press', [[8, 60]], 'first'),
          exercise('Barbell Bench Press', [[5, 75]], 'second'),
        ]),
      ],
      'Barbell Bench Press',
    )
    expect(result?.lastSession).toEqual({ reps: 5, weightKg: 75, performedAt: daysAgo(2) })
  })

  it('skips workouts where the exercise has no valid sets and uses the next one', () => {
    const result = buildExerciseInsightsFromWorkouts(
      [
        workout(daysAgo(1), [exercise('Squat', [[0, 100]])]),
        workout(daysAgo(5), [exercise('Squat', [[5, 90]])]),
      ],
      'Squat',
    )
    expect(result?.lastSession?.weightKg).toBe(90)
  })

  it('ignores other exercises in the same workout', () => {
    const result = buildExerciseInsightsFromWorkouts(
      [
        workout(daysAgo(2), [
          exercise('Lat Pulldown', [[10, 100]]),
          exercise('Squat', [[5, 90]]),
        ]),
      ],
      'Squat',
    )
    expect(result?.lastSession?.weightKg).toBe(90)
  })
})
