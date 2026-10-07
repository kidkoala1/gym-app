import { describe, expect, it } from 'vitest'
import { groupByWeek, topSet, weekLabel, workoutDisplayTitle, workoutSetCount, workoutVolume } from './workoutStats'

const bench = {
  exercise_name: 'Bench Press',
  position: 1,
  workout_sets: [
    { reps: 8, weight_kg: 80 },
    { reps: 6, weight_kg: 82.5 },
  ],
}
const curl = { exercise_name: 'Bicep Curl', position: 2, workout_sets: [{ reps: 10, weight_kg: 16 }] }

describe('workoutDisplayTitle', () => {
  it('uses the title when there is one', () => {
    expect(workoutDisplayTitle({ title: ' Push ', workout_exercises: [bench] })).toBe('Push')
  })

  it('falls back to the exercises in workout order', () => {
    expect(workoutDisplayTitle({ title: null, workout_exercises: [curl, bench] })).toBe('Bench Press + 1 more')
    expect(workoutDisplayTitle({ title: '', workout_exercises: [curl] })).toBe('Bicep Curl')
    expect(workoutDisplayTitle({ title: null, workout_exercises: [] })).toBe('Untitled workout')
  })
})

describe('counts', () => {
  it('counts sets and volume', () => {
    const workout = { title: null, workout_exercises: [bench, curl] }
    expect(workoutSetCount(workout)).toBe(3)
    expect(workoutVolume(workout)).toBe(8 * 80 + 6 * 82.5 + 10 * 16)
  })

  it('picks the heaviest set, then the one with more reps', () => {
    expect(topSet(bench.workout_sets)).toEqual({ reps: 6, weight_kg: 82.5 })
    expect(topSet([{ reps: 5, weight_kg: 60 }, { reps: 7, weight_kg: 60 }])).toEqual({ reps: 7, weight_kg: 60 })
    expect(topSet([])).toBeNull()
  })
})

describe('weeks', () => {
  const now = new Date(2026, 9, 7, 12).getTime() // Wednesday 7 October 2026

  it('groups workouts into Monday-to-Sunday weeks', () => {
    const workouts = [
      { started_at: new Date(2026, 9, 6, 18).toISOString() },
      { started_at: new Date(2026, 9, 5, 18).toISOString() },
      { started_at: new Date(2026, 9, 4, 18).toISOString() },
      { started_at: new Date(2026, 8, 22, 18).toISOString() },
    ]
    expect(groupByWeek(workouts).map((g) => g.workouts.length)).toEqual([2, 1, 1])
  })

  it('labels weeks relative to now', () => {
    expect(weekLabel(new Date(2026, 9, 5).getTime(), now)).toBe('This week')
    expect(weekLabel(new Date(2026, 8, 28).getTime(), now)).toBe('Last week')
    // Month abbreviations depend on the runtime's locale data ("Sep" or "Sept").
    expect(weekLabel(new Date(2026, 8, 21).getTime(), now)).toMatch(/^21 – 27 Sept?$/)
    expect(weekLabel(new Date(2026, 7, 31).getTime(), now)).toMatch(/^31 Aug – 6 Sept?$/)
  })
})
