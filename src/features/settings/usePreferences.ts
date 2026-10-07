import { useState } from 'react'
import { isHexColor, readableOnBlack } from '../../lib/color'
import { readLocal, storeLocal } from '../../lib/storage'

export const ACCENT_PRESETS = [
  { id: 'lime', name: 'Lime', color: '#c4f25a' },
  { id: 'green', name: 'Green', color: '#30d158' },
  { id: 'mint', name: 'Mint', color: '#63e6e2' },
  { id: 'cyan', name: 'Cyan', color: '#64d2ff' },
  { id: 'blue', name: 'Blue', color: '#0a84ff' },
  { id: 'indigo', name: 'Indigo', color: '#7d7aff' },
  { id: 'violet', name: 'Violet', color: '#a58bff' },
  { id: 'pink', name: 'Pink', color: '#ff6482' },
  { id: 'orange', name: 'Orange', color: '#ff9f0a' },
  { id: 'yellow', name: 'Yellow', color: '#ffd60a' },
] as const

export const DEFAULT_ACCENT_ID = 'lime'
export const CUSTOM_ACCENT_ID = 'custom'

/**
 * Per-device preferences, stored in localStorage like the background: the accent colour (a preset
 * or a custom colour) and whether the rest clock shows.
 */
export function usePreferences() {
  const [accentId, setAccentId] = useState(() => readLocal('accentId') || DEFAULT_ACCENT_ID)
  const [customAccent, setCustomAccent] = useState(() => {
    const stored = readLocal('customAccent')
    return isHexColor(stored) ? stored : ACCENT_PRESETS[0].color
  })
  const [restClockEnabled, setRestClockEnabled] = useState(() => readLocal('restClockEnabled') !== 'false')

  const preset = ACCENT_PRESETS.find((p) => p.id === accentId)
  // Custom colours are lightened if needed so text in the accent colour stays readable on black.
  const accentColor = accentId === CUSTOM_ACCENT_ID ? readableOnBlack(customAccent) : (preset ?? ACCENT_PRESETS[0]).color
  const accentName = accentId === CUSTOM_ACCENT_ID ? 'Custom' : (preset ?? ACCENT_PRESETS[0]).name

  function selectAccent(id: string) {
    setAccentId(id)
    storeLocal('accentId', id)
  }

  function chooseCustomAccent(color: string) {
    if (!isHexColor(color)) return
    setCustomAccent(color)
    storeLocal('customAccent', color)
    selectAccent(CUSTOM_ACCENT_ID)
  }

  function changeRestClockEnabled(enabled: boolean) {
    setRestClockEnabled(enabled)
    storeLocal('restClockEnabled', enabled ? 'true' : 'false')
  }

  return {
    accentId,
    accentColor,
    accentName,
    customAccent,
    selectAccent,
    chooseCustomAccent,
    restClockEnabled,
    changeRestClockEnabled,
  }
}
