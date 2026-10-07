import type { SetDraft } from './localTypes'

export const MAX_TITLE_LENGTH = 100
export const MAX_REPS = 1000
export const MAX_WEIGHT_KG = 2000

export function createInitialSetDraft(): SetDraft[] {
  return [{ reps: '', weight: '' }]
}

/** Accepts both "12.5" and "12,5" (comma decimal keyboards). */
export function parseLocalizedDecimal(value: string): number {
  return Number(value.trim().replace(',', '.'))
}

export function normalizeWorkoutTitle(value: string): string | null {
  const trimmed = value.trim().slice(0, MAX_TITLE_LENGTH)
  return trimmed ? trimmed : null
}

export function isValidSetValues(reps: number, weightKg: number): boolean {
  return (
    Number.isInteger(reps) &&
    Number.isFinite(weightKg) &&
    reps > 0 &&
    reps <= MAX_REPS &&
    weightKg >= 0 &&
    weightKg <= MAX_WEIGHT_KG
  )
}

/**
 * Applies one edit to a list of set rows. When the last row becomes fully filled in, a new empty
 * row is appended that starts with the same weight, so a straight set is quick to enter.
 */
export function applySetDraftChange(
  drafts: SetDraft[],
  index: number,
  field: keyof SetDraft,
  value: string,
): SetDraft[] {
  const next = drafts.map((row, i) => (i === index ? { ...row, [field]: value } : row))
  const last = next[next.length - 1]
  const editedIsLast = index === next.length - 1
  const lastFilled = last.reps.trim() !== '' && last.weight.trim() !== ''

  if (editedIsLast && lastFilled) next.push({ reps: '', weight: last.weight.trim() })
  return next
}
