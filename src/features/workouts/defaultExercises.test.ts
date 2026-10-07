import { describe, expect, it } from 'vitest'
import { DEFAULT_EXERCISE_NAMES, resolveCanonicalExerciseName } from './defaultExercises'

describe('resolveCanonicalExerciseName', () => {
  it('returns an empty string for empty or blank input', () => {
    expect(resolveCanonicalExerciseName('')).toBe('')
    expect(resolveCanonicalExerciseName('   ')).toBe('')
  })

  it('matches built-in names ignoring case, spacing and punctuation', () => {
    expect(resolveCanonicalExerciseName('barbell bench press')).toBe('Barbell Bench Press')
    expect(resolveCanonicalExerciseName('  BARBELL   BENCH PRESS ')).toBe('Barbell Bench Press')
    expect(resolveCanonicalExerciseName('pull up')).toBe('Pull-Up')
    expect(resolveCanonicalExerciseName('PULL-UP')).toBe('Pull-Up')
  })

  it('resolves built-in aliases', () => {
    expect(resolveCanonicalExerciseName('ohp')).toBe('Overhead Press')
    expect(resolveCanonicalExerciseName('RDL')).toBe('Romanian Deadlift')
    expect(resolveCanonicalExerciseName('bench press')).toBe('Barbell Bench Press')
    expect(resolveCanonicalExerciseName('lat pull down')).toBe('Lat Pulldown')
  })

  it('ignores apostrophes when matching', () => {
    expect(resolveCanonicalExerciseName("Farmer's Carry", ['Farmers Carry'])).toBe('Farmers Carry')
  })

  it('falls back to the user\'s own spelling of a custom name', () => {
    expect(resolveCanonicalExerciseName('cable tricep extensions', ['Cable Tricep Extensions'])).toBe(
      'Cable Tricep Extensions',
    )
  })

  it('prefers a built-in name over a custom one with the same key', () => {
    expect(resolveCanonicalExerciseName('face pull', ['face pull'])).toBe('Face Pull')
  })

  it('returns unknown names trimmed but otherwise unchanged', () => {
    expect(resolveCanonicalExerciseName('  Sloterdijk Chest Fly ')).toBe('Sloterdijk Chest Fly')
  })
})

describe('built-in exercise list', () => {
  it('has no empty or duplicate names', () => {
    expect(DEFAULT_EXERCISE_NAMES.every((name) => name.trim().length > 0)).toBe(true)
    const lowered = DEFAULT_EXERCISE_NAMES.map((name) => name.toLowerCase())
    expect(new Set(lowered).size).toBe(lowered.length)
  })

  it('resolves every built-in name to itself, so no alias hides a real exercise', () => {
    for (const name of DEFAULT_EXERCISE_NAMES) {
      expect(resolveCanonicalExerciseName(name)).toBe(name)
    }
  })
})
