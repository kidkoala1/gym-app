import { startOfWeek } from '../../lib/time'
import type { WorkoutHistoryRow } from '../../types/db'

type SetLike = { reps: number; weight_kg: number }
type ExerciseLike = { exercise_name: string; position: number; workout_sets: SetLike[] }
type WorkoutLike = { title: string | null; workout_exercises: ExerciseLike[] }

export function sortedExercises<T extends { position: number }>(exercises: T[] | null | undefined): T[] {
  return [...(exercises ?? [])].sort((a, b) => a.position - b.position)
}

/** The workout's title, or a name built from its exercises when it has none. */
export function workoutDisplayTitle(workout: WorkoutLike): string {
  const title = workout.title?.trim()
  if (title) return title
  const names = sortedExercises(workout.workout_exercises).map((exercise) => exercise.exercise_name)
  if (names.length === 0) return 'Untitled workout'
  return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`
}

export function workoutSetCount(workout: WorkoutLike): number {
  return workout.workout_exercises.reduce((sum, exercise) => sum + exercise.workout_sets.length, 0)
}

/** Total kilograms moved: weight × reps over every set. */
export function workoutVolume(workout: WorkoutLike): number {
  return workout.workout_exercises.reduce(
    (sum, exercise) => sum + exercise.workout_sets.reduce((s, set) => s + Number(set.weight_kg) * Number(set.reps), 0),
    0,
  )
}

/** The heaviest set (ties go to more reps), or null for no sets. */
export function topSet<T extends SetLike>(sets: T[]): T | null {
  if (sets.length === 0) return null
  return sets.reduce((best, set) =>
    Number(set.weight_kg) > Number(best.weight_kg) ||
    (Number(set.weight_kg) === Number(best.weight_kg) && Number(set.reps) > Number(best.reps))
      ? set
      : best,
  )
}

export type WeekGroup<T> = { weekStart: number; workouts: T[] }

/** Groups workouts (newest first) into Monday-to-Sunday weeks, keeping their order. */
export function groupByWeek<T extends Pick<WorkoutHistoryRow, 'started_at'>>(workouts: T[]): WeekGroup<T>[] {
  const groups: WeekGroup<T>[] = []
  for (const workout of workouts) {
    const weekStart = startOfWeek(workout.started_at)
    const last = groups[groups.length - 1]
    if (last && last.weekStart === weekStart) last.workouts.push(workout)
    else groups.push({ weekStart, workouts: [workout] })
  }
  return groups
}

/** "This week", "Last week", "22 – 28 Sep" or "29 Sep – 5 Oct". */
export function weekLabel(weekStart: number, now: number = Date.now()): string {
  const thisWeek = startOfWeek(now)
  if (weekStart === thisWeek) return 'This week'
  if (weekStart === startOfWeek(thisWeek - 1)) return 'Last week'
  const start = new Date(weekStart)
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const month = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' })
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`
}
