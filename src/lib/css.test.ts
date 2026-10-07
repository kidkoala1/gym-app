import { describe, expect, it } from 'vitest'
import { toCssUrl } from './css'

/** The text between url(" and ") of a returned value. */
function innerUrl(value: string): string {
  expect(value.startsWith('url("')).toBe(true)
  expect(value.endsWith('")')).toBe(true)
  return value.slice('url("'.length, -'")'.length)
}

describe('toCssUrl', () => {
  it('wraps https and http URLs', () => {
    expect(toCssUrl('https://example.com/bg.jpg')).toBe('url("https://example.com/bg.jpg")')
    expect(toCssUrl('http://example.com/bg.jpg')).toBe('url("http://example.com/bg.jpg")')
  })

  it('rejects other protocols', () => {
    expect(toCssUrl('javascript:alert(1)')).toBe('none')
    expect(toCssUrl('ftp://example.com/bg.jpg')).toBe('none')
    expect(toCssUrl('file:///etc/passwd')).toBe('none')
  })

  it('rejects text that is not a URL', () => {
    expect(toCssUrl('')).toBe('none')
    expect(toCssUrl('not a url')).toBe('none')
    expect(toCssUrl('example.com/bg.jpg')).toBe('none')
  })

  it('percent-encodes characters that could end the url() expression', () => {
    const inner = innerUrl(toCssUrl(`https://example.com/a"b'c(d)e\\f.jpg`))
    expect(inner).not.toMatch(/["'()\\]/)
    expect(inner.startsWith('https://example.com/')).toBe(true)
  })

  it('cannot be tricked into closing the expression and adding CSS', () => {
    const value = toCssUrl('https://example.com/x.jpg"); background: red; /*')
    const inner = innerUrl(value)
    expect(inner).not.toContain('"')
    expect(inner).not.toContain(')')
    // The whole value is still a single url("...") expression.
    expect(value.match(/\)/g)).toHaveLength(1)
  })

  it('accepts base64 image data URLs as they are', () => {
    const data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    expect(toCssUrl(data)).toBe(`url("${data}")`)
  })

  it('rejects data URLs that are not base64 images', () => {
    expect(toCssUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('none')
    expect(toCssUrl('data:image/svg+xml;utf8,<svg></svg>')).toBe('none')
  })

  it('rejects data URLs with extra characters after the base64 payload', () => {
    expect(toCssUrl('data:image/png;base64,AAAA"); background: red; /*')).toBe('none')
  })
})
