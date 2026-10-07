import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  hexToRgb,
  hslToRgb,
  isHexColor,
  readableOnBlack,
  rgbToHex,
  rgbToHsl,
  secondaryFor,
  textColorOn,
} from './color'

describe('hex conversion', () => {
  it('round-trips hex and rgb', () => {
    expect(hexToRgb('#c4f25a')).toEqual([196, 242, 90])
    expect(rgbToHex([196, 242, 90])).toBe('#c4f25a')
  })

  it('round-trips through hsl', () => {
    expect(rgbToHex(hslToRgb(rgbToHsl(hexToRgb('#0a84ff'))))).toBe('#0a84ff')
  })

  it('validates hex strings', () => {
    expect(isHexColor('#C4F25A')).toBe(true)
    expect(isHexColor('c4f25a')).toBe(false)
    expect(isHexColor('#fff')).toBe(false)
  })
})

describe('readableOnBlack', () => {
  it('keeps colours that are already readable', () => {
    expect(readableOnBlack('#c4f25a')).toBe('#c4f25a')
    expect(readableOnBlack('#0a84ff')).toBe('#0a84ff')
  })

  it('lightens dark colours until they reach 4.5:1 on black', () => {
    for (const dark of ['#102040', '#000000', '#7a0000']) {
      expect(contrastRatio(readableOnBlack(dark), '#000000')).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the hue when lightening', () => {
    const [hue] = rgbToHsl(hexToRgb(readableOnBlack('#102040')))
    expect(hue).toBeCloseTo(220, 0)
  })
})

describe('textColorOn', () => {
  it('uses dark text on light colours and white on dark ones', () => {
    expect(textColorOn('#c4f25a')).toBe('#111111')
    expect(textColorOn('#3a0a6e')).toBe('#ffffff')
  })
})

describe('secondaryFor', () => {
  it('switches to cyan for warm accents so compare lines stay distinct', () => {
    expect(secondaryFor('#ff9f0a')).toBe('#64d2ff')
    expect(secondaryFor('#ffd60a')).toBe('#64d2ff')
    expect(secondaryFor('#c4f25a')).toBe('#ff9f0a')
    expect(secondaryFor('#0a84ff')).toBe('#ff9f0a')
  })
})
