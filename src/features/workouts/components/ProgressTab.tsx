import { Box, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { getProgressSeries, searchPublicProfiles } from '../api'
import type { WorkoutHistoryRow } from '../../../types/db'

type ProgressTabProps = {
  isLoading: boolean
  workouts: WorkoutHistoryRow[]
  userId: string
}

type RangeKey = '30d' | '90d' | '365d' | 'all'
type ModeKey = 'mine' | 'compare'

type SeriesPoint = {
  dateKey: string
  dateLabel: string
  value: number
}

type CombinedSeriesPoint = {
  dateKey: string
  dateLabel: string
  primary?: number
  secondary?: number
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

function getRangeDays(range: RangeKey): number | null {
  if (range === 'all') return null
  return range === '30d' ? 30 : range === '90d' ? 90 : 365
}

function combineSeries(primary: SeriesPoint[], secondary: SeriesPoint[]): CombinedSeriesPoint[] {
  const allKeys = new Set([...primary.map((point) => point.dateKey), ...secondary.map((point) => point.dateKey)])
  const primaryByKey = new Map(primary.map((point) => [point.dateKey, point]))
  const secondaryByKey = new Map(secondary.map((point) => [point.dateKey, point]))

  return [...allKeys]
    .sort((a, b) => a.localeCompare(b))
    .map((dateKey) => {
      const primaryPoint = primaryByKey.get(dateKey)
      const secondaryPoint = secondaryByKey.get(dateKey)

      return {
        dateKey,
        dateLabel: primaryPoint?.dateLabel ?? secondaryPoint?.dateLabel ?? formatDateLabel(dateKey),
        primary: primaryPoint?.value,
        secondary: secondaryPoint?.value,
      }
    })
}

function CompareLineChart({
  title,
  unit,
  points,
  primaryLabel,
  secondaryLabel,
}: {
  title: string
  unit: string
  points: CombinedSeriesPoint[]
  primaryLabel: string
  secondaryLabel?: string
}) {
  const [activePointIndex, setActivePointIndex] = useState(0)
  const values = points.flatMap((point) => [point.primary, point.secondary]).filter((value): value is number => typeof value === 'number')

  if (values.length === 0) {
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
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min || 1
  const mid = min + spread / 2
  const safeActiveIndex = activePointIndex < points.length ? activePointIndex : points.length - 1

  const toX = (index: number) => {
    if (points.length === 1) return width / 2
    return leftPadding + (index / (points.length - 1)) * (width - leftPadding - rightPadding)
  }

  const toY = (value: number) => {
    const ratio = (value - min) / spread
    return height - bottomPadding - ratio * (height - topPadding - bottomPadding)
  }

  const buildPolyline = (key: 'primary' | 'secondary') =>
    points
      .map((point, index) =>
        typeof point[key] === 'number' ? `${toX(index)},${toY(point[key])}` : null,
      )
      .filter((value): value is string => Boolean(value))
      .join(' ')

  const primaryLine = buildPolyline('primary')
  const secondaryLine = buildPolyline('secondary')
  const selected = points[safeActiveIndex] ?? points[points.length - 1]
  const step = points.length > 1 ? (width - leftPadding - rightPadding) / (points.length - 1) : 28

  return (
    <Paper className="card" elevation={0}>
      <Stack spacing={0.35}>
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        <Stack direction="row" spacing={1.2}>
          <Typography variant="caption" sx={{ color: '#8ec5ff' }}>
            {primaryLabel}
          </Typography>
          {secondaryLabel ? (
            <Typography variant="caption" sx={{ color: '#ffae86' }}>
              {secondaryLabel}
            </Typography>
          ) : null}
        </Stack>
        <Typography variant="body2" sx={{ color: '#f0f4ff' }}>
          Selected ({selected.dateLabel}): {primaryLabel} {selected.primary?.toFixed(1) ?? '-'} {unit}
          {secondaryLabel ? ` | ${secondaryLabel} ${selected.secondary?.toFixed(1) ?? '-'} ${unit}` : ''}
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
          {primaryLine ? (
            <polyline
              fill="none"
              stroke="#8ec5ff"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={primaryLine}
            />
          ) : null}
          {secondaryLine ? (
            <polyline
              fill="none"
              stroke="#ffae86"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={secondaryLine}
            />
          ) : null}
          {points.map((point, index) => (
            <g key={`${point.dateKey}-${index}`}>
              <rect
                x={toX(index) - step / 2}
                y={topPadding}
                width={step}
                height={height - topPadding - bottomPadding}
                fill="transparent"
                onClick={() => setActivePointIndex(index)}
                onMouseEnter={() => setActivePointIndex(index)}
              />
              {typeof point.primary === 'number' ? (
                <circle
                  cx={toX(index)}
                  cy={toY(point.primary)}
                  r={safeActiveIndex === index ? 4 : 2.8}
                  fill="#d9ebff"
                />
              ) : null}
              {typeof point.secondary === 'number' ? (
                <circle
                  cx={toX(index)}
                  cy={toY(point.secondary)}
                  r={safeActiveIndex === index ? 4 : 2.8}
                  fill="#ffd3bd"
                />
              ) : null}
            </g>
          ))}
          <line
            x1={toX(safeActiveIndex)}
            y1={topPadding}
            x2={toX(safeActiveIndex)}
            y2={height - bottomPadding}
            stroke="rgba(255, 255, 255, 0.22)"
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

export function ProgressTab({ isLoading, workouts, userId }: ProgressTabProps) {
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
  const [mode, setMode] = useState<ModeKey>('mine')
  const [selectedCompareUserId, setSelectedCompareUserId] = useState('')
  const activeExercise = selectedExercise || exerciseNames[0] || ''
  const rangeDays = getRangeDays(range)

  const profilesQuery = useQuery({
    queryKey: ['public-profiles'],
    queryFn: () => searchPublicProfiles(''),
    enabled: mode === 'compare',
  })

  const compareProfiles = useMemo(
    () => (profilesQuery.data ?? []).filter((profile) => profile.id !== userId),
    [profilesQuery.data, userId],
  )
  const effectiveCompareUserId = selectedCompareUserId || compareProfiles[0]?.id || ''

  const compareSeriesQuery = useQuery({
    queryKey: ['progress-compare', effectiveCompareUserId, activeExercise, rangeDays],
    queryFn: () => getProgressSeries(effectiveCompareUserId, activeExercise, rangeDays),
    enabled: mode === 'compare' && Boolean(effectiveCompareUserId) && Boolean(activeExercise),
  })

  const filteredMine = useMemo(() => {
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
        const dateKey = new Date(workout.started_at).toISOString()

        return {
          dateKey,
          dateLabel: formatDateLabel(workout.started_at),
          maxWeight,
          totalVolume,
          totalReps,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  }, [activeExercise, range, workouts])

  const mineMaxWeightSeries: SeriesPoint[] = filteredMine.map((entry) => ({
    dateKey: entry.dateKey,
    dateLabel: entry.dateLabel,
    value: entry.maxWeight,
  }))
  const mineVolumeSeries: SeriesPoint[] = filteredMine.map((entry) => ({
    dateKey: entry.dateKey,
    dateLabel: entry.dateLabel,
    value: entry.totalVolume,
  }))
  const mineRepsSeries: SeriesPoint[] = filteredMine.map((entry) => ({
    dateKey: entry.dateKey,
    dateLabel: entry.dateLabel,
    value: entry.totalReps,
  }))

  const compareRows = compareSeriesQuery.data ?? []
  const compareMaxWeightSeries: SeriesPoint[] = compareRows.map((entry) => ({
    dateKey: entry.bucket_date,
    dateLabel: formatDateLabel(entry.bucket_date),
    value: Number(entry.max_weight),
  }))
  const compareVolumeSeries: SeriesPoint[] = compareRows.map((entry) => ({
    dateKey: entry.bucket_date,
    dateLabel: formatDateLabel(entry.bucket_date),
    value: Number(entry.total_volume),
  }))
  const compareRepsSeries: SeriesPoint[] = compareRows.map((entry) => ({
    dateKey: entry.bucket_date,
    dateLabel: formatDateLabel(entry.bucket_date),
    value: Number(entry.total_reps),
  }))

  const maxWeightPoints = combineSeries(
    mineMaxWeightSeries,
    mode === 'compare' ? compareMaxWeightSeries : [],
  )
  const volumePoints = combineSeries(
    mineVolumeSeries,
    mode === 'compare' ? compareVolumeSeries : [],
  )
  const repsPoints = combineSeries(
    mineRepsSeries,
    mode === 'compare' ? compareRepsSeries : [],
  )

  const bestWeightMine = mineMaxWeightSeries.length > 0 ? Math.max(...mineMaxWeightSeries.map((p) => p.value)) : 0
  const bestWeightCompare =
    compareMaxWeightSeries.length > 0 ? Math.max(...compareMaxWeightSeries.map((p) => p.value)) : 0
  const selectedCompareUser = compareProfiles.find((profile) => profile.id === effectiveCompareUserId)

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
            <Stack direction="row" spacing={0.6}>
              <Button
                size="small"
                variant={mode === 'mine' ? 'contained' : 'outlined'}
                onClick={() => setMode('mine')}
              >
                Mine
              </Button>
              <Button
                size="small"
                variant={mode === 'compare' ? 'contained' : 'outlined'}
                onClick={() => setMode('compare')}
              >
                Compare
              </Button>
            </Stack>

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

            {mode === 'compare' ? (
              profilesQuery.isLoading ? (
                <Typography variant="body2" className="muted">
                  Loading public users...
                </Typography>
              ) : compareProfiles.length === 0 ? (
                <Typography variant="body2" className="muted">
                  No public users available to compare yet.
                </Typography>
              ) : (
                <TextField
                  select
                  label="Compare With"
                  value={effectiveCompareUserId}
                  onChange={(event) => setSelectedCompareUserId(event.target.value)}
                  size="small"
                >
                  {compareProfiles.map((profile) => (
                    <MenuItem key={profile.id} value={profile.id}>
                      {profile.display_name || 'User'}
                    </MenuItem>
                  ))}
                </TextField>
              )
            ) : null}

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
                  Your best weight
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{bestWeightMine.toFixed(1)} kg</Typography>
              </Paper>
              {mode === 'compare' ? (
                <Paper className="card" elevation={0} sx={{ flex: 1, p: 0.7 }}>
                  <Typography variant="caption" className="muted">
                    {selectedCompareUser?.display_name || 'User'} best
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>{bestWeightCompare.toFixed(1)} kg</Typography>
                </Paper>
              ) : null}
              <Paper className="card" elevation={0} sx={{ flex: 1, p: 0.7 }}>
                <Typography variant="caption" className="muted">
                  Your sessions
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{filteredMine.length}</Typography>
              </Paper>
            </Stack>

            {mode === 'compare' && compareSeriesQuery.isLoading ? (
              <Typography variant="body2" className="muted">
                Loading compare data...
              </Typography>
            ) : null}

            <CompareLineChart
              title="Max Weight Trend"
              unit="kg"
              points={maxWeightPoints}
              primaryLabel="You"
              secondaryLabel={mode === 'compare' ? selectedCompareUser?.display_name || 'User' : undefined}
            />
            <CompareLineChart
              title="Volume Trend"
              unit="kg"
              points={volumePoints}
              primaryLabel="You"
              secondaryLabel={mode === 'compare' ? selectedCompareUser?.display_name || 'User' : undefined}
            />
            <CompareLineChart
              title="Total Reps Trend"
              unit="reps"
              points={repsPoints}
              primaryLabel="You"
              secondaryLabel={mode === 'compare' ? selectedCompareUser?.display_name || 'User' : undefined}
            />
          </>
        )}
      </Stack>
    </Paper>
  )
}
