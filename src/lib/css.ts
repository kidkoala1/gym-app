/**
 * Turns a user-supplied image URL into a safe CSS `url(...)` value, or `none`.
 * Only http(s) URLs and base64 image data URLs are accepted, and characters that could end
 * the url() expression are percent-encoded.
 */
export function toCssUrl(value: string): string {
  if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(value)) return `url("${value}")`

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'none'
    return `url("${encodeURI(url.href).replace(/["'()\\]/g, (char) => `%${char.charCodeAt(0).toString(16)}`)}")`
  } catch {
    return 'none'
  }
}
