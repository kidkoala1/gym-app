import { Box, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMemo, useState } from 'react'
import type { WorkoutHistoryRow } from '../../../types/db'

type ProgressTabProps = {
  isLoading: boolean
  workouts: WorkoutHistoryRow[]
}

type RangeKey = '30d' | '90d' | '365d' | 'all'

type SeriesPoint = {
  dateLabel: string
  value: number
}

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '365d', label: '1Y' },
  { key: 'all', label: 'All' },
]

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function getRangeCutoff(range: RangeKey): number | null {
  if (range === 'all') return null
  const now = Date.now()
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 365
  return now - days * 24 * 60 * 60 * 1000
}

function LineChart({
  title,
  unit,
  points,
}: {
  title: string
  unit: string
  points: SeriesPoint[]
}) {
  if (points.length === 0) {
    return (
      <Paper className="card" elevation={0}>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{title}</Typography>
        <Typography variant="body2" className="muted">
          No data in selected range.
        </Typography>
      </Paper>
    )
  }

  const width = 360
  const height = 140
  const leftPadding = 42
  const rightPadding = 14
  const topPadding = 10
  const bottomPadding = 16
  const min = Math.min(...points.map((p) => p.value))
  const max = Math.max(...points.map((p) => p.value))
  const spread = max - min || 1
  const mid = min + spread / 2
  const [activePointIndex, setActivePointIndex] = useState(points.length - 1)

  const toX = (index: number) => {
    if (points.length === 1) return width / 2
    return leftPadding + (index / (points.length - 1)) * (width - leftPadding - rightPadding)
  }

  const toY = (value: number) => {
    const ratio = (value - min) / spread
    return height - bottomPadding - ratio * (height - topPadding - bottomPadding)
  }

  const polyline = points.map((point, index) => `${toX(index)},${toY(point.value)}`).join(' ')
  const latest = points[points.length - 1]
  const activePoint = points[activePointIndex] ?? latest

  return (
    <Paper className="card" elevation={0}>
      <Stack spacing={0.35}>
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        <Typography variant="body2" className="muted">
          Latest: {latest.value.toFixed(1)} {unit}
        </Typography>
        <Typography variant="body2" sx={{ color: '#f0f4ff' }}>
          Selected: {activePoint.value.toFixed(1)} {unit} on {activePoint.dateLabel}
        </Typography>
      </Stack>
      <Box sx={{ mt: 0.8 }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="150" preserveAspectRatio="none">
          {[min, mid, max].map((value, idx) => {
            const y = toY(value)
            return (
              <g key={`${title}-grid-${idx}`}>
                <line
                  x1={leftPadding}
                  y1={y}
                  x2={width - rightPadding}
                  y2={y}
                  stroke="rgba(201, 207, 255, 0.2)"
                  strokeDasharray="3 3"
                />
                <text x={leftPadding - 6} y={y + 3} textAnchor="end" fill="rgba(230, 236, 255, 0.75)" fontSize="9">
                  {value.toFixed(1)}
                </text>
              </g>
            )
          })}
          <line
            x1={leftPadding}
            y1={height - bottomPadding}
            x2={width - rightPadding}
            y2={height - bottomPadding}
            stroke="rgba(201, 207, 255, 0.35)"
          />
          <polyline
            fill="none"
            stroke="#8ec5ff"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polyline}
          />
          {points.map((point, index) => (
            <g key={`${point.dateLabel}-${index}`}>
              <circle
                cx={toX(index)}
                cy={toY(point.value)}
                r="10"
                fill="transparent"
                onMouseEnter={() => setActivePointIndex(index)}
                onClick={() => setActivePointIndex(index)}
              />
              <circle
                cx={toX(index)}
                cy={toY(point.value)}
                r={activePointIndex === index ? '4' : '2.8'}
                fill={activePointIndex === index ? '#ffffff' : '#d9ebff'}
              />
            </g>
          ))}
          <line
            x1={toX(activePointIndex)}
            y1={topPadding}
            x2={toX(activePointIndex)}
            y2={height - bottomPadding}
            stroke="rgba(142, 197, 255, 0.35)"
          />
        </svg>
      </Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption" className="muted">
          {points[0].dateLabel}
        </Typography>
        <Typography variant="caption" className="muted">
          {points[points.length - 1].dateLabel}
        </Typography>
      </Stack>
    </Paper>
  )
}

export function ProgressTab({ isLoading, workouts }: ProgressTabProps) {
  const exerciseNames = useMemo(() => {
    const set = new Set<string>()
    workouts.forEach((workout) => {
      ;(workout.workout_exercises ?? []).forEach((exercise) => {
        const trimmed = exercise.exercise_name.trim()
        if (trimmed) set.add(trimmed)
      })
    })
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [workouts])

  const [selectedExercise, setSelectedExercise] = useState('')
  const [range, setRange] = useState<RangeKey>('90d')

  const activeExercise = selectedExercise || exerciseNames[0] || ''

  const filteredWorkouts = useMemo(() => {
    if (!activeExercise) return []
    const cutoff = getRangeCutoff(range)

    return workouts
      .filter((workout) => {
        const timestamp = new Date(workout.started_at).getTime()
        return cutoff === null || timestamp >= cutoff
      })
      .map((workout) => {
        const matching = (workout.workout_exercises ?? []).filter(
          (exercise) => exercise.exercise_name.toLowerCase() === activeExercise.toLowerCase(),
        )

        const sets = matching.flatMap((exercise) => exercise.workout_sets ?? [])
        if (sets.length === 0) return null

        const maxWeight = Math.max(...sets.map((set) => set.weight_kg))
        const totalVolume = sets.reduce((sum, set) => sum + set.reps * set.weight_kg, 0)
        const totalReps = sets.reduce((sum, set) => sum + set.reps, 0)

        return {
          startedAt: workout.started_at,
          dateLabel: formatDateLabel(workout.started_at),
          maxWeight,
          totalVolume,
          totalReps,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
  }, [activeExercise, range, workouts])

  const maxWeightSeries = filteredWorkouts.map((entry) => ({
    dateLabel: entry.dateLabel,
    value: entry.maxWeight,
  }))
  const volumeSeries = filteredWorkouts.map((entry) => ({
    dateLabel: entry.dateLabel,
    value: entry.totalVolume,
  }))
  const repsSeries = filteredWorkouts.map((entry) => ({
    dateLabel: entry.dateLabel,
    value: entry.totalReps,
  }))

  const bestWeight = maxWeightSeries.length > 0 ? Math.max(...maxWeightSeries.map((p) => p.value)) : 0
  const totalVolume = volumeSeries.reduce((sum, point) => sum + point.value, 0)

  return (
    <Paper className="panel" elevation={0}>
      <Stack spacing={1.1}>
        <Typography variant="h6" sx={{ fontSize: '1rem' }}>
          Progress
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}>
            <CircularProgress size={26} />
          </Box>
        ) : exerciseNames.length === 0 ? (
          <Typography className="muted">No completed workout data yet. Finish workouts to see progress.</Typography>
        ) : (
          <>
            <TextField
              select
              label="Exercise"
              value={activeExercise}
              onChange={(event) => setSelectedExercise(event.target.value)}
              size="small"
            >
              {exerciseNames.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction="row" spacing={0.6}>
              {RANGE_OPTIONS.map((option) => {
                const selected = range === option.key
                return (
                  <Button
                    key={option.key}
                    size="small"
                    variant={selected ? 'contained' : 'outlined'}
                    onClick={() => setRange(option.key)}
                  >
                    {option.label}
                  </Button>
                )
              })}
            </Stack>

            <Stack direction="row" spacing={0.7}>
              <Paper className="card" elevation={0} sx={{ flex: 1, p: 0.7 }}>
                <Typography variant="caption" className="muted">
                  Best weight
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{bestWeight.toFixed(1)} kg</Typography>
              </Paper>
              <Paper className="card" elevation={0} sx={{ flex: 1, p: 0.7 }}>
                <Typography variant="caption" className="muted">
                  Total volume
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{totalVolume.toFixed(0)} kg</Typography>
              </Paper>
              <Paper className="card" elevation={0} sx={{ flex: 1, p: 0.7 }}>
                <Typography variant="caption" className="muted">
                  Sessions
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{filteredWorkouts.length}</Typography>
              </Paper>
            </Stack>

            <LineChart title="Max Weight Trend" unit="kg" points={maxWeightSeries} />
            <LineChart title="Volume Trend" unit="kg" points={volumeSeries} />
            <LineChart title="Total Reps Trend" unit="reps" points={repsSeries} />
          </>
        )}
      </Stack>
    </Paper>
  )
}
