import { describe, expect, it } from 'vitest'
import {
  MAX_REPS,
  MAX_TITLE_LENGTH,
  MAX_WEIGHT_KG,
  isValidSetValues,
  normalizeWorkoutTitle,
  parseLocalizedDecimal,
} from './setInput'

describe('parseLocalizedDecimal', () => {
  it('parses dot and comma decimals', () => {
    expect(parseLocalizedDecimal('12.5')).toBe(12.5)
    expect(parseLocalizedDecimal('12,5')).toBe(12.5)
  })

  it('ignores surrounding whitespace', () => {
    expect(parseLocalizedDecimal('  7 ')).toBe(7)
  })

  it('returns NaN for text', () => {
    expect(parseLocalizedDecimal('abc')).toBeNaN()
    expect(parseLocalizedDecimal('12kg')).toBeNaN()
  })

  it('treats an empty string as 0, so callers must filter blank inputs first', () => {
    expect(parseLocalizedDecimal('')).toBe(0)
  })
})

describe('normalizeWorkoutTitle', () => {
  it('trims the title', () => {
    expect(normalizeWorkoutTitle('  Push day  ')).toBe('Push day')
  })

  it('returns null for empty or blank titles', () => {
    expect(normalizeWorkoutTitle('')).toBeNull()
    expect(normalizeWorkoutTitle('   ')).toBeNull()
  })

  it('cuts titles to the maximum length', () => {
    const result = normalizeWorkoutTitle('x'.repeat(MAX_TITLE_LENGTH + 50))
    expect(result).toHaveLength(MAX_TITLE_LENGTH)
  })
})

describe('isValidSetValues', () => {
  it('accepts normal sets', () => {
    expect(isValidSetValues(8, 60)).toBe(true)
    expect(isValidSetValues(12, 22.5)).toBe(true)
  })

  it('accepts bodyweight sets (weight 0)', () => {
    expect(isValidSetValues(10, 0)).toBe(true)
  })

  it('accepts the exact limits', () => {
    expect(isValidSetValues(MAX_REPS, MAX_WEIGHT_KG)).toBe(true)
    expect(isValidSetValues(1, 0)).toBe(true)
  })

  it('rejects zero or negative reps', () => {
    expect(isValidSetValues(0, 50)).toBe(false)
    expect(isValidSetValues(-3, 50)).toBe(false)
  })

  it('rejects reps above the limit', () => {
    expect(isValidSetValues(MAX_REPS + 1, 50)).toBe(false)
  })

  it('rejects negative weight and weight above the limit', () => {
    expect(isValidSetValues(8, -1)).toBe(false)
    expect(isValidSetValues(8, MAX_WEIGHT_KG + 0.01)).toBe(false)
  })

  it('rejects NaN and infinite values', () => {
    expect(isValidSetValues(Number.NaN, 50)).toBe(false)
    expect(isValidSetValues(8, Number.NaN)).toBe(false)
    expect(isValidSetValues(Number.POSITIVE_INFINITY, 50)).toBe(false)
    expect(isValidSetValues(8, Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('rejects fractional reps, because the database column is an integer', () => {
    expect(isValidSetValues(2.5, 50)).toBe(false)
    expect(isValidSetValues(0.5, 50)).toBe(false)
  })
})
