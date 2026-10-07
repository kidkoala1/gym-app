import { describe, expect, it } from 'vitest'
import { calendarDaysBetween, formatClock, startOfWeek } from './time'

describe('formatClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(42_400)).toBe('0:42')
    expect(formatClock(12 * 60_000 + 5_000)).toBe('12:05')
  })

  it('adds hours past one hour', () => {
    expect(formatClock(3_600_000 + 2 * 60_000 + 9_000)).toBe('1:02:09')
  })

  it('treats negative durations as zero', () => {
    expect(formatClock(-5_000)).toBe('0:00')
  })
})

describe('startOfWeek', () => {
  it('returns the Monday at midnight', () => {
    const wednesday = new Date(2026, 9, 7, 18, 30)
    expect(new Date(startOfWeek(wednesday))).toEqual(new Date(2026, 9, 5))
  })

  it('treats Sunday as the end of the week', () => {
    const sunday = new Date(2026, 9, 11, 9)
    expect(new Date(startOfWeek(sunday))).toEqual(new Date(2026, 9, 5))
  })
})

describe('calendarDaysBetween', () => {
  it('counts calendar days, not 24-hour periods', () => {
    expect(calendarDaysBetween(new Date(2026, 9, 6, 23, 50), new Date(2026, 9, 7, 0, 10))).toBe(1)
    expect(calendarDaysBetween(new Date(2026, 9, 7, 8), new Date(2026, 9, 7, 22))).toBe(0)
  })
})
