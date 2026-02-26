export interface ExerciseRow {
  id: string
  user_id: string
  name: string
  created_at: string
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

export interface WorkoutSetInput {
  reps: number
  weightKg: number
}
