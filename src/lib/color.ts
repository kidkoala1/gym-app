// Colour helpers for the accent colour. Colours are 6-digit hex strings like '#c4f25a'.

export type Rgb = [number, number, number]

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex(rgb: Rgb): string {
  return '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Hue in degrees (0-360), saturation and lightness (0-1). */
export function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return [h * 60, s, l]
}

export function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

const MIN_CONTRAST_ON_BLACK = 4.5

/** Lightens a colour (keeping its hue) until it reaches 4.5:1 contrast on black. */
export function readableOnBlack(hex: string): string {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  let lightness = l
  let out = hex
  while (contrastRatio(out, '#000000') < MIN_CONTRAST_ON_BLACK && lightness < 0.95) {
    lightness += 0.03
    out = rgbToHex(hslToRgb([h, s, lightness]))
  }
  return out
}

/** Black or white, whichever reads better on the given background. */
export function textColorOn(hex: string): '#111111' | '#ffffff' {
  return contrastRatio(hex, '#111111') >= contrastRatio(hex, '#ffffff') ? '#111111' : '#ffffff'
}

/** A second colour for comparison lines that stays distinct from the accent: cyan for warm accents, orange otherwise. */
export function secondaryFor(hex: string): string {
  const [h, s] = rgbToHsl(hexToRgb(hex))
  return s > 0.15 && h >= 15 && h <= 70 ? '#64d2ff' : '#ff9f0a'
}
