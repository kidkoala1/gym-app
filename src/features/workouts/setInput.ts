export const MAX_TITLE_LENGTH = 100
export const MAX_REPS = 1000
export const MAX_WEIGHT_KG = 2000

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
