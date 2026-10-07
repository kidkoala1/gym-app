import { useEffect, useId, useRef, useState } from 'react'
import { formatTick, nearestIndex, niceTicks } from '../chartScale'
import { longDate, shortDate } from '../format'

export type ChartPoint = { time: number; value: number }

type ProgressChartProps = {
  mine: ChartPoint[]
  other?: ChartPoint[]
  otherName?: string
  formatValue: (value: number) => string
  /** Extra line under the date, e.g. the session's top set. */
  describe?: (index: number) => string | undefined
  label: string
}

const HEIGHT = 200
const PAD = { left: 40, right: 12, top: 12, bottom: 26 }
const DAY_MS = 24 * 60 * 60 * 1000

/** A line chart over time; drag a finger across it to read each session. */
export function ProgressChart({ mine, other = [], otherName, formatValue, describe, label }: ProgressChartProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const scrubbing = useRef(false)
  const gradientId = useId()
  const [width, setWidth] = useState(320)
  const [selected, setSelected] = useState<number | null>(null)
  const hasData = mine.length > 0

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(host)
    return () => observer.disconnect()
  }, [hasData])

  if (!hasData) return null

  const all = [...mine, ...other]
  let t0 = Math.min(...all.map((p) => p.time))
  let t1 = Math.max(...all.map((p) => p.time))
  if (t0 === t1) {
    t0 -= DAY_MS
    t1 += DAY_MS
  }
  const ticks = niceTicks(Math.min(...all.map((p) => p.value)), Math.max(...all.map((p) => p.value)))
  const y0 = ticks[0]
  const y1 = ticks[ticks.length - 1]
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * (width - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - y0) / (y1 - y0 || 1)) * (HEIGHT - PAD.top - PAD.bottom)
  const path = (points: ChartPoint[]) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${x(p.time).toFixed(1)},${y(p.value).toFixed(1)}`).join('')
  const base = HEIGHT - PAD.bottom
  const area = `${path(mine)}L${x(mine[mine.length - 1].time).toFixed(1)},${base}L${x(mine[0].time).toFixed(1)},${base}Z`

  const index = selected === null ? mine.length - 1 : Math.min(selected, mine.length - 1)
  const point = mine[index]
  const otherPoint = other.filter((p) => p.time <= point.time + DAY_MS / 2).pop()
  const detail = describe?.(index)

  function pick(clientX: number) {
    const host = hostRef.current
    if (!host) return
    const left = host.getBoundingClientRect().left
    setSelected(nearestIndex(mine.map((p) => x(p.time)), clientX - left))
  }

  return (
    <>
      <div className="readout" aria-live="polite">
        <div className="d">
          {longDate(point.time)}
          {detail ? ` · ${detail}` : ''}
        </div>
        <div className="v">{formatValue(point.value)}</div>
        {otherPoint && otherName ? (
          <div className="o">
            {otherName} <b>{formatValue(otherPoint.value)}</b> on {shortDate(otherPoint.time)}
          </div>
        ) : null}
      </div>
      <div
        ref={hostRef}
        className="chart"
        role="img"
        aria-label={`${label}. Drag across the chart to read each session.`}
        onPointerDown={(e) => {
          scrubbing.current = true
          pick(e.clientX)
        }}
        onPointerMove={(e) => {
          if (scrubbing.current || e.pointerType === 'mouse') pick(e.clientX)
        }}
        onPointerUp={() => (scrubbing.current = false)}
        onPointerCancel={() => (scrubbing.current = false)}
      >
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="c-area-top" />
              <stop offset="1" className="c-area-bottom" />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line className="c-grid" x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} />
              <text className="c-text" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">
                {formatTick(v)}
              </text>
            </g>
          ))}
          {[t0, (t0 + t1) / 2, t1].map((t, i) => (
            <text key={i} className="c-text" x={x(t)} y={HEIGHT - 6} textAnchor={(['start', 'middle', 'end'] as const)[i]}>
              {shortDate(t)}
            </text>
          ))}
          <path d={area} fill={`url(#${gradientId})`} />
          {other.length > 0 ? <path className="c-other" d={path(other)} /> : null}
          <path className="c-mine" d={path(mine)} />
          <line className="c-cursor" x1={x(point.time)} x2={x(point.time)} y1={PAD.top} y2={base} />
          {otherPoint ? <circle className="c-dot2" cx={x(otherPoint.time)} cy={y(otherPoint.value)} r={5} /> : null}
          <circle className="c-dot" cx={x(point.time)} cy={y(point.value)} r={5.5} />
        </svg>
      </div>
    </>
  )
}
