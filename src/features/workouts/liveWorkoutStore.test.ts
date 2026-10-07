import { describe, expect, it, vi } from 'vitest'
import type { WorkoutEditExercise, WorkoutEditResult } from './api'
import { createLiveWorkoutStore } from './liveWorkoutStore'
import { addExercise, updateSetField, type DraftWorkout } from './workoutDraft'

function setup() {
  const requests: WorkoutEditExercise[][] = []
  const pending: Array<(result: WorkoutEditResult) => void> = []
  const save = vi.fn((_: string, payload: WorkoutEditExercise[]) => {
    requests.push(payload)
    return new Promise<WorkoutEditResult>((resolve) => pending.push(resolve))
  })
  const store = createLiveWorkoutStore({ save, onChange: () => {}, onSyncError: () => {}, onSaved: () => {} })
  const start: DraftWorkout = { id: 'w1', startedAt: '2026-10-07T18:00:00Z', title: null, exercises: [] }
  const { workout, key } = addExercise(start, 'Bench Press', '80')
  store.replace(workout)
  return { store, key, requests, pending }
}

function typeInLastRow(store: ReturnType<typeof setup>['store'], exKey: string, field: 'weight' | 'reps', value: string) {
  const sets = store.get()!.exercises[0].sets
  store.update((w) => updateSetField(w, exKey, sets[sets.length - 1].key, field, value))
}

describe('createLiveWorkoutStore', () => {
  it('sends each set once, even when typing continues while a save is running', async () => {
    const { store, key, requests, pending } = setup()

    typeInLastRow(store, key, 'reps', '8')
    const first = store.flush()
    await vi.waitFor(() => expect(pending).toHaveLength(1))

    // While the first save is running, the next set is typed and another save is requested.
    typeInLastRow(store, key, 'reps', '6')
    const second = store.flush()
    pending[0]([{ id: 'e1', set_ids: ['s1'] }])
    await first
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1]([{ id: 'e1', set_ids: ['s2'] }])
    await second

    expect(requests).toEqual([
      [{ name: 'Bench Press', sets: [{ reps: 8, weight_kg: 80 }] }],
      [{ id: 'e1', sets: [{ reps: 6, weight_kg: 80 }] }],
    ])
    expect(store.get()!.exercises[0].sets.map((s) => s.id)).toEqual(['s1', 's2', null])
  })

  it('does not call the database when nothing changed', async () => {
    const { store, requests } = setup()
    await expect(store.flush()).resolves.toBe(true)
    expect(requests).toEqual([])
  })
})
