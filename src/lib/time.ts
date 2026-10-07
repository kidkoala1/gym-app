/** "0:42", "12:05" or "1:02:09" for a duration in milliseconds (negative counts as zero). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Midnight at the start of the Monday of the week containing `time`, in local time. */
export function startOfWeek(time: number | string | Date): number {
  const d = new Date(time)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** Whole calendar days between two moments, in local time (0 = same day). */
export function calendarDaysBetween(earlier: number | string | Date, later: number | string | Date): number {
  const a = new Date(earlier)
  const b = new Date(later)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}
