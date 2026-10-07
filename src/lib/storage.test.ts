import { afterEach, describe, expect, it, vi } from 'vitest'
import { readLocal, removeLocal, storeLocal } from './storage'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  }
}

function brokenStorage(): Storage {
  const fail = () => {
    throw new Error('storage unavailable')
  }
  return {
    get length() {
      return fail()
    },
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('storage helpers with working storage', () => {
  it('stores, reads and removes values', () => {
    vi.stubGlobal('localStorage', memoryStorage())

    expect(storeLocal('theme', 'dark')).toBe(true)
    expect(readLocal('theme')).toBe('dark')

    removeLocal('theme')
    expect(readLocal('theme')).toBe('')
  })

  it('returns an empty string for keys that were never stored', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(readLocal('missing')).toBe('')
  })
})

describe('storage helpers when localStorage throws (private mode, quota, blocked data)', () => {
  it('reads as an empty string instead of throwing', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(readLocal('anything')).toBe('')
  })

  it('reports a failed write instead of throwing', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(storeLocal('anything', 'value')).toBe(false)
  })

  it('removes without throwing', () => {
    vi.stubGlobal('localStorage', brokenStorage())
    expect(() => removeLocal('anything')).not.toThrow()
  })
})
