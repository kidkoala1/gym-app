import type { WorkoutEditExercise, WorkoutEditSet } from './api'
import { isValidSetValues, parseLocalizedDecimal } from './setInput'

/**
 * A workout being edited on the phone: the live workout, or a past one opened for editing in
 * History. Every row keeps what the database last confirmed (`id`, `saved`), so the changes still
 * to send can be worked out at any time with `buildSyncRequest` and confirmed with
 * `applySyncResult`. All functions here are pure; they return a new draft instead of changing one.
 *
 * Rules for sets:
 * - A row is "complete" when it has a valid weight and whole-number reps. Complete rows are saved;
 *   incomplete rows are not. A saved row that becomes incomplete again is deleted from the database.
 * - Every exercise ends with exactly one incomplete row, so the next set is always ready to fill in.
 *   It starts with the weight of the set above it.
 */

export type SetValues = { reps: number; weightKg: number }

export type DraftSet = {
  key: string
  id: string | null
  weight: string
  reps: string
  saved: SetValues | null
}

export type DraftExercise = {
  key: string
  id: string | null
  name: string
  /** The name the database has, so a rename is only sent when it changed. */
  savedName: string | null
  sets: DraftSet[]
  /** Ids of saved sets that were swiped away and still have to be deleted. */
  deletedSetIds: string[]
  /** Removed by the user; kept until the database has deleted it. */
  removed: boolean
}

export type DraftWorkout = {
  id: string
  startedAt: string
  title: string | null
  exercises: DraftExercise[]
}

type ServerWorkout = {
  id: string
  started_at: string
  title: string | null
  workout_exercises: Array<{
    id: string
    exercise_name: string
    position: number
    workout_sets: Array<{ id: string; set_number: number; reps: number; weight_kg: number }>
  }>
}

let keyCounter = 0
export function newKey(): string {
  keyCounter += 1
  return `${Date.now().toString(36)}-${keyCounter}`
}

/** "82.5" for 82.5, "60" for 60. */
export function formatWeight(kg: number): string {
  return String(Math.round(kg * 100) / 100)
}

export function parseSetValues(weight: string, reps: string): SetValues | null {
  if (!weight.trim() || !reps.trim()) return null
  const r = Number(reps.trim())
  const w = parseLocalizedDecimal(weight)
  return isValidSetValues(r, w) ? { reps: r, weightKg: w } : null
}

/** True when the database has exactly what the row shows. */
export function isSetSaved(set: DraftSet): boolean {
  const values = parseSetValues(set.weight, set.reps)
  return Boolean(set.id && set.saved && values && values.reps === set.saved.reps && values.weightKg === set.saved.weightKg)
}

function emptySet(weight = ''): DraftSet {
  return { key: newKey(), id: null, weight, reps: '', saved: null }
}

/** Appends an empty row (carrying the last weight over) when the last row is complete. */
export function withTrailingRow(sets: DraftSet[], firstWeight = ''): DraftSet[] {
  const last = sets[sets.length - 1]
  if (!last) return [emptySet(firstWeight)]
  if (!parseSetValues(last.weight, last.reps)) return sets
  return [...sets, emptySet(last.weight.trim())]
}

export function draftFromServer(workout: ServerWorkout): DraftWorkout {
  return {
    id: workout.id,
    startedAt: workout.started_at,
    title: workout.title,
    exercises: [...workout.workout_exercises]
      .sort((a, b) => a.position - b.position)
      .map((exercise) => ({
        key: exercise.id,
        id: exercise.id,
        name: exercise.exercise_name,
        savedName: exercise.exercise_name,
        deletedSetIds: [],
        removed: false,
        sets: withTrailingRow(
          [...exercise.workout_sets]
            .sort((a, b) => a.set_number - b.set_number)
            .map((set) => {
              const saved = { reps: Number(set.reps), weightKg: Number(set.weight_kg) }
              return { key: set.id, id: set.id, weight: formatWeight(saved.weightKg), reps: String(saved.reps), saved }
            }),
        ),
      })),
  }
}

function mapExercise(workout: DraftWorkout, exKey: string, fn: (exercise: DraftExercise) => DraftExercise): DraftWorkout {
  return { ...workout, exercises: workout.exercises.map((exercise) => (exercise.key === exKey ? fn(exercise) : exercise)) }
}

export function updateSetField(
  workout: DraftWorkout,
  exKey: string,
  setKey: string,
  field: 'weight' | 'reps',
  value: string,
): DraftWorkout {
  return mapExercise(workout, exKey, (exercise) => ({
    ...exercise,
    sets: withTrailingRow(exercise.sets.map((set) => (set.key === setKey ? { ...set, [field]: value } : set))),
  }))
}

export function removeSet(workout: DraftWorkout, exKey: string, setKey: string): DraftWorkout {
  return mapExercise(workout, exKey, (exercise) => {
    const target = exercise.sets.find((set) => set.key === setKey)
    if (!target) return exercise
    const remaining = exercise.sets.filter((set) => set.key !== setKey)
    const lastWeight = (remaining[remaining.length - 1] ?? target).weight.trim()
    return {
      ...exercise,
      sets: withTrailingRow(remaining, lastWeight),
      deletedSetIds: target.id ? [...exercise.deletedSetIds, target.id] : exercise.deletedSetIds,
    }
  })
}

export function addExercise(workout: DraftWorkout, name: string, firstWeight = ''): { workout: DraftWorkout; key: string } {
  const key = newKey()
  const exercise: DraftExercise = {
    key,
    id: null,
    name,
    savedName: null,
    sets: withTrailingRow([], firstWeight),
    deletedSetIds: [],
    removed: false,
  }
  return { workout: { ...workout, exercises: [...workout.exercises, exercise] }, key }
}

/** Fills the first row's weight, but only while the exercise is still untouched. */
export function prefillFirstWeight(workout: DraftWorkout, exKey: string, weight: string): DraftWorkout {
  return mapExercise(workout, exKey, (exercise) => {
    const [first, ...rest] = exercise.sets
    if (!first || rest.length > 0 || first.id || first.weight.trim() || first.reps.trim()) return exercise
    return { ...exercise, sets: [{ ...first, weight }] }
  })
}

export function renameExercise(workout: DraftWorkout, exKey: string, name: string): DraftWorkout {
  return mapExercise(workout, exKey, (exercise) => ({ ...exercise, name }))
}

export function removeExercise(workout: DraftWorkout, exKey: string): DraftWorkout {
  return mapExercise(workout, exKey, (exercise) => ({ ...exercise, removed: true }))
}

export function visibleExercises(workout: DraftWorkout): DraftExercise[] {
  return workout.exercises.filter((exercise) => !exercise.removed)
}

/** Complete rows of the exercises still in the workout, as numbers. */
export function completedSets(exercise: DraftExercise): SetValues[] {
  return exercise.sets.map((set) => parseSetValues(set.weight, set.reps)).filter((v): v is SetValues => v !== null)
}

export type SyncPlanEntry = {
  exKey: string
  kind: 'create' | 'update' | 'delete'
  /** The name sent with this request, if any. */
  sentName: string | null
  /** One entry per set in the request, in the same order. */
  sets: Array<{ setKey: string | null; values: SetValues | null; deletedId?: string }>
}

export type SyncResult = Array<{ id: string; set_ids?: Array<string | null>; deleted?: boolean }>

/** The save_workout_edit request that brings the database up to date with the draft. */
export function buildSyncRequest(workout: DraftWorkout): { payload: WorkoutEditExercise[]; plan: SyncPlanEntry[] } {
  const payload: WorkoutEditExercise[] = []
  const plan: SyncPlanEntry[] = []

  for (const exercise of workout.exercises) {
    if (exercise.removed) {
      if (exercise.id) {
        payload.push({ id: exercise.id, deleted: true })
        plan.push({ exKey: exercise.key, kind: 'delete', sentName: null, sets: [] })
      }
      continue
    }

    const sets: WorkoutEditSet[] = []
    const refs: SyncPlanEntry['sets'] = []

    for (const set of exercise.sets) {
      const values = parseSetValues(set.weight, set.reps)
      if (values && !set.id) {
        sets.push({ reps: values.reps, weight_kg: values.weightKg })
        refs.push({ setKey: set.key, values })
      } else if (values && set.id && !isSetSaved(set)) {
        sets.push({ id: set.id, reps: values.reps, weight_kg: values.weightKg })
        refs.push({ setKey: set.key, values })
      } else if (!values && set.id) {
        sets.push({ id: set.id, deleted: true })
        refs.push({ setKey: set.key, values: null })
      }
    }
    for (const id of exercise.deletedSetIds) {
      sets.push({ id, deleted: true })
      refs.push({ setKey: null, values: null, deletedId: id })
    }

    const name = exercise.name.trim()
    if (!exercise.id) {
      // A new exercise is created together with its first complete set.
      if (sets.length === 0 || !name) continue
      payload.push({ name, sets })
      plan.push({ exKey: exercise.key, kind: 'create', sentName: name, sets: refs })
      continue
    }

    const renamed = name !== '' && name !== exercise.savedName
    if (sets.length === 0 && !renamed) continue
    payload.push({ id: exercise.id, ...(renamed && { name }), sets })
    plan.push({ exKey: exercise.key, kind: 'update', sentName: renamed ? name : null, sets: refs })
  }

  return { payload, plan }
}

/** Records the ids and values the database confirmed. Edits made while the request was running are kept. */
export function applySyncResult(workout: DraftWorkout, plan: SyncPlanEntry[], result: SyncResult): DraftWorkout {
  let exercises = workout.exercises

  plan.forEach((entry, i) => {
    const res = result[i]
    if (!res) return
    if (entry.kind === 'delete') {
      exercises = exercises.filter((exercise) => exercise.key !== entry.exKey)
      return
    }

    exercises = exercises.map((exercise) => {
      if (exercise.key !== entry.exKey) return exercise
      let sets = exercise.sets
      let deletedSetIds = exercise.deletedSetIds

      entry.sets.forEach((ref, j) => {
        const setId = res.set_ids?.[j] ?? null
        if (ref.deletedId) {
          deletedSetIds = deletedSetIds.filter((id) => id !== ref.deletedId)
          return
        }
        if (!sets.some((set) => set.key === ref.setKey)) {
          // The row was swiped away while it was being saved: delete it next time.
          if (setId && !deletedSetIds.includes(setId)) deletedSetIds = [...deletedSetIds, setId]
          return
        }
        sets = sets.map((set) => {
          if (set.key !== ref.setKey) return set
          return ref.values ? { ...set, id: setId, saved: ref.values } : { ...set, id: null, saved: null }
        })
      })

      return { ...exercise, id: res.id, savedName: entry.sentName ?? exercise.savedName, sets, deletedSetIds }
    })
  })

  return { ...workout, exercises }
}
