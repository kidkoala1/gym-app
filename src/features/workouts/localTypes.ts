export type SetDraft = {
  reps: string
  weight: string
}

export type CompletedSet = {
  reps: number
  weightKg: number
}

export type LocalWorkoutExercise = {
  name: string
  sets: CompletedSet[]
}

export type ActiveWorkout = {
  id: string
  startedAt: string
  exercises: LocalWorkoutExercise[]
}

export type EditableSet = {
  id: string
  set_number: number
  reps: string
  weight_kg: string
}

export type EditableHistoryExercise = {
  id: string
  exercise_name: string
  sets: EditableSet[]
  deleted?: boolean
}

export type SettingsView = 'menu' | 'exercise-list' | 'profile'
