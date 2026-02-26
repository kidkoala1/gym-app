export interface ExerciseRow {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface ProfileRow {
  id: string
  display_name: string | null
  avatar_url: string | null
  is_progress_public?: boolean
  created_at: string
}

export interface PublicProfileRow {
  id: string
  display_name: string
}

export interface WorkoutRow {
  id: string
  user_id: string
  started_at: string
  finished_at: string | null
  created_at: string
}

export interface WorkoutExerciseRow {
  id: string
  workout_id: string
  exercise_name: string
  position: number
}

export interface WorkoutSetRow {
  id: string
  workout_exercise_id: string
  set_number: number
  reps: number
  weight_kg: number
}

export interface WorkoutWithExerciseRefs {
  id: string
  started_at: string
  finished_at: string | null
  workout_exercises: Array<{ id: string }>
}

export interface WorkoutHistorySet {
  id: string
  set_number: number
  reps: number
  weight_kg: number
}

export interface WorkoutHistoryExercise {
  id: string
  exercise_name: string
  position: number
  workout_sets: WorkoutHistorySet[]
}

export interface WorkoutHistoryRow {
  id: string
  started_at: string
  finished_at: string | null
  workout_exercises: WorkoutHistoryExercise[]
}

export interface WorkoutSetInput {
  reps: number
  weightKg: number
}

export interface ProgressSeriesRow {
  bucket_date: string
  max_weight: number
  total_volume: number
  total_reps: number
}
