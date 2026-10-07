import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './errors'

describe('getErrorMessage', () => {
  it('returns the message of an Error', () => {
    expect(getErrorMessage(new Error('Boom'), 'fallback')).toBe('Boom')
  })

  it('uses the fallback when the Error has no message', () => {
    expect(getErrorMessage(new Error(''), 'fallback')).toBe('fallback')
  })

  it('uses the fallback for values that are not Errors', () => {
    expect(getErrorMessage('a string', 'fallback')).toBe('fallback')
    expect(getErrorMessage(null, 'fallback')).toBe('fallback')
    expect(getErrorMessage({ message: 'object with message' }, 'fallback')).toBe('fallback')
  })
})
