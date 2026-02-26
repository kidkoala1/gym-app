import { supabase } from '../../lib/supabase'
import type {
  ExerciseRow,
  WorkoutRow,
  WorkoutSetInput,
  WorkoutSetRow,
  WorkoutExerciseRow,
  WorkoutWithExerciseRefs,
} from '../../types/db'

function throwSupabaseError(error: { message: string; code?: string | null }) {
  const enriched = new Error(error.message) as Error & { code?: string | null }
  enriched.code = error.code
  throw enriched
}

export async function listExercises(userId: string): Promise<ExerciseRow[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id,user_id,name,created_at')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throwSupabaseError(error)
  return (data ?? []) as ExerciseRow[]
}

export async function createExercise(userId: string, name: string): Promise<ExerciseRow> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({ user_id: userId, name })
    .select('id,user_id,name,created_at')
    .single()

  if (error) throwSupabaseError(error)
  return data as ExerciseRow
}

export async function updateExerciseName(
  id: string,
  userId: string,
  name: string,
): Promise<ExerciseRow> {
  const { data, error } = await supabase
    .from('exercises')
    .update({ name })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id,user_id,name,created_at')
    .single()

  if (error) throwSupabaseError(error)
  return data as ExerciseRow
}

export async function deleteExercise(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from('exercises').delete().eq('id', id).eq('user_id', userId)
  if (error) throwSupabaseError(error)
}

export async function createWorkout(userId: string, startedAt: string): Promise<WorkoutRow> {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, started_at: startedAt })
    .select('id,user_id,started_at,finished_at,created_at')
    .single()

  if (error) throwSupabaseError(error)
  return data as WorkoutRow
}

export async function finishWorkout(
  workoutId: string,
  userId: string,
  finishedAt: string,
): Promise<WorkoutRow> {
  const { data, error } = await supabase
    .from('workouts')
    .update({ finished_at: finishedAt })
    .eq('id', workoutId)
    .eq('user_id', userId)
    .select('id,user_id,started_at,finished_at,created_at')
    .single()

  if (error) throwSupabaseError(error)
  return data as WorkoutRow
}

export async function insertWorkoutExercise(
  workoutId: string,
  exerciseName: string,
  position: number,
): Promise<WorkoutExerciseRow> {
  const { data, error } = await supabase
    .from('workout_exercises')
    .insert({ workout_id: workoutId, exercise_name: exerciseName, position })
    .select('id,workout_id,exercise_name,position')
    .single()

  if (error) throwSupabaseError(error)
  return data as WorkoutExerciseRow
}

export async function insertWorkoutSets(
  workoutExerciseId: string,
  sets: WorkoutSetInput[],
): Promise<WorkoutSetRow[]> {
  const payload = sets.map((set, index) => ({
    workout_exercise_id: workoutExerciseId,
    set_number: index + 1,
    reps: set.reps,
    weight_kg: set.weightKg,
  }))

  const { data, error } = await supabase
    .from('workout_sets')
    .insert(payload)
    .select('id,workout_exercise_id,set_number,reps,weight_kg')

  if (error) throwSupabaseError(error)
  return (data ?? []) as WorkoutSetRow[]
}

export async function listRecentWorkouts(
  userId: string,
  limit: number,
): Promise<WorkoutWithExerciseRefs[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id,started_at,finished_at,workout_exercises(id)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throwSupabaseError(error)
  return (data ?? []) as WorkoutWithExerciseRefs[]
}
