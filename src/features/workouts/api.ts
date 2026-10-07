import { supabase } from '../../lib/supabase'
import type {
  ExerciseInsightHistoryRow,
  ExerciseRow,
  WorkoutRow,
  WorkoutHistoryRow,
  ProgressSeriesRow,
  PublicProfileRow,
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

export async function createWorkout(userId: string, startedAt: string, title?: string | null): Promise<WorkoutRow> {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, started_at: startedAt, title: title || null })
    .select('id,user_id,started_at,finished_at,title,created_at')
    .single()

  if (error) throwSupabaseError(error)
  return data as WorkoutRow
}

export async function finishWorkout(
  workoutId: string,
  userId: string,
  finishedAt: string,
  title?: string | null,
): Promise<WorkoutRow> {
  const { data, error } = await supabase
    .from('workouts')
    .update({ finished_at: finishedAt, ...(title !== undefined && { title: title || null }) })
    .eq('id', workoutId)
    .eq('user_id', userId)
    .select('id,user_id,started_at,finished_at,title,created_at')
    .single()

  if (error) throwSupabaseError(error)
  return data as WorkoutRow
}

export async function deleteWorkout(workoutId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', workoutId).eq('user_id', userId)
  if (error) throwSupabaseError(error)
}

export type WorkoutEditSet = {
  id?: string
  reps: number
  weight_kg: number
}

export type WorkoutEditExercise = {
  id?: string
  deleted?: boolean
  name?: string
  sets?: WorkoutEditSet[]
}

/**
 * Applies a whole workout edit in one database transaction (see save_workout_edit).
 * Exercises without an id are appended after the workout's last position.
 */
export async function saveWorkoutEdit(workoutId: string, exercises: WorkoutEditExercise[]): Promise<void> {
  const { error } = await supabase.rpc('save_workout_edit', {
    p_workout_id: workoutId,
    p_exercises: exercises,
  })

  if (error) throwSupabaseError(error)
}

export type WorkoutHistoryPage = {
  workouts: WorkoutHistoryRow[]
  hasMore: boolean
}

/** One page of the user's workouts, newest first. `page` is zero-based. */
export async function listWorkoutHistoryPage(
  userId: string,
  page: number,
  pageSize: number,
): Promise<WorkoutHistoryPage> {
  const from = page * pageSize

  // Ask for one extra row so we know whether another page exists without a count query.
  const { data, error } = await supabase
    .from('workouts')
    .select(
      'id,started_at,finished_at,title,workout_exercises(id,exercise_name,canonical_exercise_name,position,workout_sets(id,set_number,reps,weight_kg))',
    )
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + pageSize)

  if (error) throwSupabaseError(error)

  const rows = (data ?? []) as WorkoutHistoryRow[]
  return { workouts: rows.slice(0, pageSize), hasMore: rows.length > pageSize }
}

export async function listLoggedExerciseNames(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_logged_exercise_names')

  if (error) throwSupabaseError(error)
  return (data ?? []) as string[]
}

export async function getCanonicalExerciseName(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('canonical_exercise_name', { name })

  if (error) throwSupabaseError(error)
  return (data as string | null) ?? name.trim()
}

// Weight suggestions need the last session plus the best set of the last 60 days; one session per day at most.
const EXERCISE_INSIGHT_SESSION_LIMIT = 60

export async function listExerciseInsightHistory(
  userId: string,
  canonicalExerciseName: string,
): Promise<ExerciseInsightHistoryRow[]> {
  if (!canonicalExerciseName) return []

  const { data, error } = await supabase
    .from('workouts')
    .select(
      'id,started_at,workout_exercises!inner(id,exercise_name,canonical_exercise_name,position,workout_sets(id,set_number,reps,weight_kg))',
    )
    .eq('user_id', userId)
    .eq('workout_exercises.canonical_exercise_name', canonicalExerciseName)
    .order('started_at', { ascending: false })
    .limit(EXERCISE_INSIGHT_SESSION_LIMIT)

  if (error) throwSupabaseError(error)
  return (data ?? []) as ExerciseInsightHistoryRow[]
}

export async function getProgressSeries(
  targetUserId: string,
  targetExercise: string,
  rangeDays: number | null,
): Promise<ProgressSeriesRow[]> {
  const { data, error } = await supabase.rpc('get_progress_series', {
    target_user_id: targetUserId,
    target_exercise: targetExercise,
    range_days: rangeDays,
  })

  if (error) throwSupabaseError(error)
  return (data ?? []) as ProgressSeriesRow[]
}

export async function searchPublicProfiles(query: string): Promise<PublicProfileRow[]> {
  const { data, error } = await supabase.rpc('search_public_profiles', { q: query })

  if (error) throwSupabaseError(error)
  return (data ?? []) as PublicProfileRow[]
}

export type UnfinishedWorkout = {
  id: string
  started_at: string
  title: string | null
  workout_exercises: Array<{
    id: string
    exercise_name: string
    position: number
    workout_sets: Array<{ set_number: number; reps: number; weight_kg: number }>
  }>
}

// Only a recently started workout counts as "in progress"; older unfinished ones are abandoned sessions.
const RESUME_WINDOW_HOURS = 12

export async function getUnfinishedWorkout(userId: string): Promise<UnfinishedWorkout | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id,started_at,title,workout_exercises(id,exercise_name,position,workout_sets(set_number,reps,weight_kg))')
    .eq('user_id', userId)
    .is('finished_at', null)
    .gte('started_at', new Date(Date.now() - RESUME_WINDOW_HOURS * 60 * 60 * 1000).toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throwSupabaseError(error)
  return (data as UnfinishedWorkout | null) ?? null
}
