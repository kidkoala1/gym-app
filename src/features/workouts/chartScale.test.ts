import { describe, expect, it } from 'vitest'
import { formatTick, nearestIndex, niceTicks } from './chartScale'

describe('niceTicks', () => {
  it('covers the range with a few round, evenly spaced steps', () => {
    expect(niceTicks(72.5, 85)).toEqual([70, 75, 80, 85])
    expect(niceTicks(1800, 2650)).toEqual([1500, 2000, 2500, 3000])
    expect(niceTicks(28, 34)).toEqual([28, 30, 32, 34])
  })

  it('still draws an axis for a single value', () => {
    const ticks = niceTicks(80, 80)
    expect(ticks[0]).toBeLessThan(80)
    expect(ticks[ticks.length - 1]).toBeGreaterThan(80)
  })
})

describe('formatTick', () => {
  it('shortens thousands', () => {
    expect(formatTick(82.5)).toBe('82.5')
    expect(formatTick(2600)).toBe('2.6k')
    expect(formatTick(12000)).toBe('12k')
  })
})

describe('nearestIndex', () => {
  it('finds the closest point', () => {
    expect(nearestIndex([0, 50, 100], 70)).toBe(1)
    expect(nearestIndex([0, 50, 100], 80)).toBe(2)
  })
})
