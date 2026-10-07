import { describe, expect, it } from 'vitest'
import {
  addExercise,
  applySyncResult,
  buildSyncRequest,
  draftFromServer,
  isSetSaved,
  parseSetValues,
  prefillFirstWeight,
  removeExercise,
  removeSet,
  renameExercise,
  updateSetField,
  withTrailingRow,
  type DraftWorkout,
} from './workoutDraft'

function emptyWorkout(): DraftWorkout {
  return { id: 'w1', startedAt: '2026-10-07T18:00:00Z', title: 'Push', exercises: [] }
}

/** Types weight and reps into the exercise's last row, like the user does. */
function logSet(workout: DraftWorkout, exKey: string, weight: string, reps: string): DraftWorkout {
  const exercise = workout.exercises.find((e) => e.key === exKey)!
  const row = exercise.sets[exercise.sets.length - 1]
  const withWeight = updateSetField(workout, exKey, row.key, 'weight', weight)
  return updateSetField(withWeight, exKey, row.key, 'reps', reps)
}

describe('parseSetValues', () => {
  it('needs a weight and whole-number reps', () => {
    expect(parseSetValues('62,5', '8')).toEqual({ reps: 8, weightKg: 62.5 })
    expect(parseSetValues('60', '')).toBeNull()
    expect(parseSetValues('', '8')).toBeNull()
    expect(parseSetValues('60', '7.5')).toBeNull()
    expect(parseSetValues('60', '0')).toBeNull()
  })

  it('accepts bodyweight sets', () => {
    expect(parseSetValues('0', '12')).toEqual({ reps: 12, weightKg: 0 })
  })
})

describe('trailing row', () => {
  it('starts an exercise with one row holding the given weight', () => {
    const { workout } = addExercise(emptyWorkout(), 'Bench Press', '80')
    expect(workout.exercises[0].sets.map((s) => [s.weight, s.reps])).toEqual([['80', '']])
  })

  it('adds the next row with the same weight and empty reps once a row is complete', () => {
    const { workout, key } = addExercise(emptyWorkout(), 'Bench Press', '80')
    const next = logSet(workout, key, '80', '8')
    expect(next.exercises[0].sets.map((s) => [s.weight, s.reps])).toEqual([
      ['80', '8'],
      ['80', ''],
    ])
  })

  it('does not add a row while the last row is incomplete', () => {
    const { workout } = addExercise(emptyWorkout(), 'Bench Press')
    const row = workout.exercises[0].sets[0]
    const next = updateSetField(workout, workout.exercises[0].key, row.key, 'weight', '80')
    expect(next.exercises[0].sets).toHaveLength(1)
  })

  it('keeps an empty row after the last one is deleted', () => {
    const { workout, key } = addExercise(emptyWorkout(), 'Bench Press', '80')
    const logged = logSet(workout, key, '80', '8')
    const firstKey = logged.exercises[0].sets[0].key
    const lastKey = logged.exercises[0].sets[1].key
    const next = removeSet(removeSet(logged, key, lastKey), key, firstKey)
    expect(next.exercises[0].sets.map((s) => [s.weight, s.reps])).toEqual([['80', '']])
  })

  it('withTrailingRow leaves a list ending in an incomplete row alone', () => {
    const sets = withTrailingRow([], '60')
    expect(withTrailingRow(sets)).toBe(sets)
  })
})

describe('prefillFirstWeight', () => {
  it('fills an untouched first row', () => {
    const { workout, key } = addExercise(emptyWorkout(), 'Bench Press')
    expect(prefillFirstWeight(workout, key, '80').exercises[0].sets[0].weight).toBe('80')
  })

  it('does not overwrite what the user typed', () => {
    const { workout, key } = addExercise(emptyWorkout(), 'Bench Press')
    const row = workout.exercises[0].sets[0]
    const typed = updateSetField(workout, key, row.key, 'weight', '70')
    expect(prefillFirstWeight(typed, key, '80').exercises[0].sets[0].weight).toBe('70')
  })
})

describe('buildSyncRequest / applySyncResult', () => {
  it('sends nothing for an exercise without complete sets', () => {
    const { workout } = addExercise(emptyWorkout(), 'Bench Press', '80')
    expect(buildSyncRequest(workout).payload).toEqual([])
  })

  it('creates a new exercise together with its first set, then records the ids', () => {
    const { workout, key } = addExercise(emptyWorkout(), 'Bench Press', '80')
    const logged = logSet(workout, key, '80', '8')
    const { payload, plan } = buildSyncRequest(logged)
    expect(payload).toEqual([{ name: 'Bench Press', sets: [{ reps: 8, weight_kg: 80 }] }])

    const synced = applySyncResult(logged, plan, [{ id: 'e1', set_ids: ['s1'] }])
    expect(synced.exercises[0].id).toBe('e1')
    expect(synced.exercises[0].sets[0]).toMatchObject({ id: 's1', saved: { reps: 8, weightKg: 80 } })
    expect(isSetSaved(synced.exercises[0].sets[0])).toBe(true)
    expect(buildSyncRequest(synced).payload).toEqual([])
  })

  it('appends new sets to an existing exercise and updates changed ones', () => {
    let w = draftFromServer({
      id: 'w1',
      started_at: '2026-10-07T18:00:00Z',
      title: null,
      workout_exercises: [
        { id: 'e1', exercise_name: 'Bench Press', position: 1, workout_sets: [{ id: 's1', set_number: 1, reps: 8, weight_kg: 80 }] },
      ],
    })
    const [first] = w.exercises[0].sets
    w = updateSetField(w, 'e1', first.key, 'reps', '9')
    w = logSet(w, 'e1', '80', '7')
    expect(buildSyncRequest(w).payload).toEqual([
      { id: 'e1', sets: [{ id: 's1', reps: 9, weight_kg: 80 }, { reps: 7, weight_kg: 80 }] },
    ])
  })

  it('deletes a saved set when it is swiped away or emptied', () => {
    let w = draftFromServer({
      id: 'w1',
      started_at: '2026-10-07T18:00:00Z',
      title: null,
      workout_exercises: [
        {
          id: 'e1',
          exercise_name: 'Bench Press',
          position: 1,
          workout_sets: [
            { id: 's1', set_number: 1, reps: 8, weight_kg: 80 },
            { id: 's2', set_number: 2, reps: 8, weight_kg: 80 },
          ],
        },
      ],
    })
    w = removeSet(w, 'e1', 's1')
    w = updateSetField(w, 'e1', 's2', 'reps', '')
    const { payload, plan } = buildSyncRequest(w)
    expect(payload).toEqual([{ id: 'e1', sets: [{ id: 's2', deleted: true }, { id: 's1', deleted: true }] }])

    const synced = applySyncResult(w, plan, [{ id: 'e1', set_ids: [null, null] }])
    expect(synced.exercises[0].deletedSetIds).toEqual([])
    expect(synced.exercises[0].sets[0]).toMatchObject({ id: null, saved: null })
    expect(buildSyncRequest(synced).payload).toEqual([])
  })

  it('keeps edits made while a save was running, and sends them next time', () => {
    const { workout, key } = addExercise(emptyWorkout(), 'Bench Press', '80')
    const logged = logSet(workout, key, '80', '8')
    const { plan } = buildSyncRequest(logged)
    const rowKey = logged.exercises[0].sets[0].key
    const editedMeanwhile = updateSetField(logged, key, rowKey, 'reps', '10')

    const synced = applySyncResult(editedMeanwhile, plan, [{ id: 'e1', set_ids: ['s1'] }])
    expect(synced.exercises[0].sets[0]).toMatchObject({ id: 's1', reps: '10', saved: { reps: 8, weightKg: 80 } })
    expect(buildSyncRequest(synced).payload).toEqual([{ id: 'e1', sets: [{ id: 's1', reps: 10, weight_kg: 80 }] }])
  })

  it('deletes a set that was swiped away while it was being created', () => {
    const { workout, key } = addExercise(emptyWorkout(), 'Bench Press', '80')
    const logged = logSet(workout, key, '80', '8')
    const { plan } = buildSyncRequest(logged)
    const swiped = removeSet(logged, key, logged.exercises[0].sets[0].key)

    const synced = applySyncResult(swiped, plan, [{ id: 'e1', set_ids: ['s1'] }])
    expect(buildSyncRequest(synced).payload).toEqual([{ id: 'e1', sets: [{ id: 's1', deleted: true }] }])
  })

  it('sends a rename only when the name changed', () => {
    const { workout, key } = addExercise(emptyWorkout(), 'Bench Press', '80')
    const logged = logSet(workout, key, '80', '8')
    const { plan } = buildSyncRequest(logged)
    const synced = applySyncResult(logged, plan, [{ id: 'e1', set_ids: ['s1'] }])

    expect(buildSyncRequest(renameExercise(synced, key, 'Bench Press ')).payload).toEqual([])
    expect(buildSyncRequest(renameExercise(synced, key, 'Incline Bench Press')).payload).toEqual([
      { id: 'e1', name: 'Incline Bench Press', sets: [] },
    ])
  })

  it('deletes a removed exercise once it exists in the database, and forgets it afterwards', () => {
    const { workout, key } = addExercise(emptyWorkout(), 'Bench Press', '80')
    const unsaved = removeExercise(workout, key)
    expect(buildSyncRequest(unsaved).payload).toEqual([])

    const logged = logSet(workout, key, '80', '8')
    const created = applySyncResult(logged, buildSyncRequest(logged).plan, [{ id: 'e1', set_ids: ['s1'] }])
    const removed = removeExercise(created, key)
    const { payload, plan } = buildSyncRequest(removed)
    expect(payload).toEqual([{ id: 'e1', deleted: true }])
    expect(applySyncResult(removed, plan, [{ id: 'e1', deleted: true }]).exercises).toEqual([])
  })
})

describe('draftFromServer', () => {
  it('orders exercises and sets, marks them saved and adds the next empty row', () => {
    const draft = draftFromServer({
      id: 'w1',
      started_at: '2026-10-07T18:00:00Z',
      title: 'Push',
      workout_exercises: [
        { id: 'e2', exercise_name: 'Lateral Raise', position: 2, workout_sets: [] },
        {
          id: 'e1',
          exercise_name: 'Bench Press',
          position: 1,
          workout_sets: [
            { id: 's2', set_number: 2, reps: 7, weight_kg: 82.5 },
            { id: 's1', set_number: 1, reps: 8, weight_kg: 82.5 },
          ],
        },
      ],
    })
    expect(draft.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Lateral Raise'])
    expect(draft.exercises[0].sets.map((s) => [s.id, s.weight, s.reps])).toEqual([
      ['s1', '82.5', '8'],
      ['s2', '82.5', '7'],
      [null, '82.5', ''],
    ])
    expect(draft.exercises[0].sets.slice(0, 2).every(isSetSaved)).toBe(true)
    expect(buildSyncRequest(draft).payload).toEqual([])
  })
})
