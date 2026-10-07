/** Round axis values (steps of 1, 2, 2.5 or 5 × 10ⁿ) covering min..max with about `count` ticks. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  let lo = min
  let hi = max
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const raw = (hi - lo) / (count - 1)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const norm = raw / magnitude
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude
  const start = Math.floor(lo / step) * step
  const end = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(6)))
  return ticks
}

/** Short axis label: 82.5, 950, 2.6k, 12k. */
export function formatTick(value: number): string {
  if (value >= 10_000) return `${Math.round(value / 1000)}k`
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`
  return String(Math.round(value * 10) / 10)
}

/** Index of the point whose x is closest to `x`. */
export function nearestIndex(xs: number[], x: number): number {
  let best = 0
  let bestDistance = Infinity
  xs.forEach((value, i) => {
    const distance = Math.abs(value - x)
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  })
  return best
}
