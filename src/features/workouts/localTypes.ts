// Client-only UI types (database rows are in src/types/db.ts; workout drafts in workoutDraft.ts).

export type SettingsView = 'menu' | 'exercise-list' | 'profile' | 'appearance' | 'rest-clock'

export type ExerciseInsightSet = {
  reps: number
  weightKg: number
  performedAt: string
}

export type ExerciseWeightInsights = {
  suggestedToday: ExerciseInsightSet | null
  lastSession: ExerciseInsightSet | null
  recentBest: ExerciseInsightSet | null
}
