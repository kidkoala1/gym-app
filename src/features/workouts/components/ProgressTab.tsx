import { Box, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { getProfile } from '../../profile/api'
import { listWorkoutHistory, searchPublicProfiles } from '../api'
import type { WorkoutHistoryRow } from '../../../types/db'

type ProgressTabProps = {
  isLoading: boolean
  workouts: WorkoutHistoryRow[]
  userId: string
  errorMessage?: string | null
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

type DailyProgressEntry = {
  dateKey: string
  dateLabel: string
  maxWeight: number
  totalVolume: number
  totalReps: number
}

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '365d', label: '1Y' },
  { key: 'all', label: 'All' },
]

function toDateKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10)
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function normalizeExerciseName(value: string): string {
  return value.trim().toLowerCase()
}

function getRangeCutoff(range: RangeKey): number | null {
  if (range === 'all') return null
  const now = Date.now()
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 365
  return now - days * 24 * 60 * 60 * 1000
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

function buildExerciseDailyProgress(
  workouts: WorkoutHistoryRow[],
  exerciseName: string,
  range: RangeKey,
): DailyProgressEntry[] {
  if (!exerciseName) return []
  const cutoff = getRangeCutoff(range)
  const targetName = normalizeExerciseName(exerciseName)
  const byDate = new Map<string, DailyProgressEntry>()

  workouts.forEach((workout) => {
    const timestamp = new Date(workout.started_at).getTime()
    if (cutoff !== null && timestamp < cutoff) return

    const matching = (workout.workout_exercises ?? []).filter(
      (exercise) => normalizeExerciseName(exercise.exercise_name) === targetName,
    )
    const sets = matching.flatMap((exercise) => exercise.workout_sets ?? [])
    if (sets.length === 0) return

    const dateKey = toDateKey(workout.started_at)
    const nextMax = Math.max(...sets.map((set) => set.weight_kg))
    const nextVolume = sets.reduce((sum, set) => sum + set.reps * set.weight_kg, 0)
    const nextReps = sets.reduce((sum, set) => sum + set.reps, 0)
    const existing = byDate.get(dateKey)

    if (existing) {
      byDate.set(dateKey, {
        ...existing,
        maxWeight: Math.max(existing.maxWeight, nextMax),
        totalVolume: existing.totalVolume + nextVolume,
        totalReps: existing.totalReps + nextReps,
      })
      return
    }

    byDate.set(dateKey, {
      dateKey,
      dateLabel: formatDateLabel(dateKey),
      maxWeight: nextMax,
      totalVolume: nextVolume,
      totalReps: nextReps,
    })
  })

  return [...byDate.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
}

function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybe = error as { status?: number; code?: string | null }
  const code = (maybe.code ?? '').toUpperCase()
  return maybe.status === 401 || maybe.status === 403 || code === '42501' || code === 'PGRST301' || code === 'PGRST302'
}

function getErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const maybe = error as { message?: unknown }
  if (typeof maybe.message !== 'string') return null
  const message = maybe.message.trim()
  return message || null
}

function formatBestWeight(value: number | null): string {
  if (value === null) return '-'
  return `${value.toFixed(1)} kg`
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

export function ProgressTab({ isLoading, workouts, userId, errorMessage }: ProgressTabProps) {
  const exerciseNames = useMemo(() => {
    const seen = new Set<string>()
    const names: string[] = []
    workouts.forEach((workout) => {
      ;(workout.workout_exercises ?? []).forEach((exercise) => {
        const trimmed = exercise.exercise_name.trim()
        const key = normalizeExerciseName(trimmed)
        if (trimmed && !seen.has(key)) {
          seen.add(key)
          names.push(trimmed)
        }
      })
    })
    return names.sort((a, b) => a.localeCompare(b))
  }, [workouts])

  const [selectedExercise, setSelectedExercise] = useState('')
  const [range, setRange] = useState<RangeKey>('90d')
  const [mode, setMode] = useState<ModeKey>('mine')
  const [selectedCompareUserId, setSelectedCompareUserId] = useState('')
  const activeExercise = selectedExercise || exerciseNames[0] || ''
  const mineUnavailable = Boolean(errorMessage)
  const noExerciseData = exerciseNames.length === 0

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
  const selectedCompareUser = compareProfiles.find((profile) => profile.id === effectiveCompareUserId)
  const isCompareOwner = effectiveCompareUserId === userId

  const compareProfileQuery = useQuery({
    queryKey: ['profile-visibility', effectiveCompareUserId],
    queryFn: () => getProfile(effectiveCompareUserId),
    enabled: mode === 'compare' && Boolean(effectiveCompareUserId),
  })

  const compareKnownPrivate =
    mode === 'compare' &&
    Boolean(effectiveCompareUserId) &&
    !isCompareOwner &&
    compareProfileQuery.isSuccess &&
    compareProfileQuery.data?.is_progress_public === false

  const compareHistoryQuery = useQuery({
    queryKey: ['compare-workout-history', effectiveCompareUserId],
    queryFn: () => listWorkoutHistory(effectiveCompareUserId),
    enabled:
      mode === 'compare' &&
      Boolean(effectiveCompareUserId) &&
      !compareKnownPrivate &&
      !mineUnavailable &&
      !noExerciseData,
  })

  const mineExerciseDaily = useMemo(() => {
    return buildExerciseDailyProgress(workouts, activeExercise, range)
  }, [activeExercise, range, workouts])

  const compareExerciseDaily = useMemo(
    () => buildExerciseDailyProgress(compareHistoryQuery.data ?? [], activeExercise, range),
    [compareHistoryQuery.data, activeExercise, range],
  )

  const mineDaily = mineExerciseDaily

  const mineMaxWeightSeries: SeriesPoint[] = mineDaily.map((entry) => ({
    dateKey: entry.dateKey,
    dateLabel: entry.dateLabel,
    value: entry.maxWeight,
  }))
  const mineVolumeSeries: SeriesPoint[] = mineDaily.map((entry) => ({
    dateKey: entry.dateKey,
    dateLabel: entry.dateLabel,
    value: entry.totalVolume,
  }))
  const mineRepsSeries: SeriesPoint[] = mineDaily.map((entry) => ({
    dateKey: entry.dateKey,
    dateLabel: entry.dateLabel,
    value: entry.totalReps,
  }))

  const compareMaxWeightSeries: SeriesPoint[] =
    mode === 'compare'
      ? compareExerciseDaily.map((entry) => ({
          dateKey: entry.dateKey,
          dateLabel: entry.dateLabel,
          value: entry.maxWeight,
        }))
      : []
  const compareVolumeSeries: SeriesPoint[] =
    mode === 'compare'
      ? compareExerciseDaily.map((entry) => ({
          dateKey: entry.dateKey,
          dateLabel: entry.dateLabel,
          value: entry.totalVolume,
        }))
      : []
  const compareRepsSeries: SeriesPoint[] =
    mode === 'compare'
      ? compareExerciseDaily.map((entry) => ({
          dateKey: entry.dateKey,
          dateLabel: entry.dateLabel,
          value: entry.totalReps,
        }))
      : []

  const maxWeightPoints = combineSeries(mineMaxWeightSeries, compareMaxWeightSeries)
  const volumePoints = combineSeries(mineVolumeSeries, compareVolumeSeries)
  const repsPoints = combineSeries(mineRepsSeries, compareRepsSeries)

  const bestWeightMine = mineMaxWeightSeries.length > 0 ? Math.max(...mineMaxWeightSeries.map((p) => p.value)) : null
  const bestWeightCompare = compareMaxWeightSeries.length > 0 ? Math.max(...compareMaxWeightSeries.map((p) => p.value)) : null
  const compareHasPermissionError = isPermissionDeniedError(compareHistoryQuery.error) || isPermissionDeniedError(compareProfileQuery.error)
  const compareStatusMessage = useMemo(() => {
    if (mode !== 'compare') return ''
    if (mineUnavailable) return errorMessage ?? 'Unable to load your workout history.'
    if (noExerciseData) return 'No completed workout data yet. Finish workouts to compare.'
    if (profilesQuery.isLoading) return 'Loading users to compare...'
    if (profilesQuery.isError) return 'Unable to load users to compare right now.'
    if (compareProfiles.length === 0) return 'No public users available to compare yet.'
    if (!effectiveCompareUserId) return 'Select a user to compare.'
    if (compareKnownPrivate) return "This user's progress is private."
    if (compareProfileQuery.isLoading) return 'Checking profile visibility...'
    if (compareHistoryQuery.isLoading) return 'Loading compare data...'
    if (compareHasPermissionError) return "You do not have permission to view this user's progress."
    if (compareHistoryQuery.isError) {
      return getErrorMessage(compareHistoryQuery.error) ?? 'Unable to load compare progress. Try again.'
    }
    if ((compareHistoryQuery.data ?? []).length === 0 || compareExerciseDaily.length === 0) {
      if (isCompareOwner) return 'You have no workouts in this range.'
      if (compareProfileQuery.data?.is_progress_public === true) {
        return `${selectedCompareUser?.display_name || 'This user'} has no ${activeExercise} data in this range.`
      }
      return 'No visible progress found for this user.'
    }
    return ''
  }, [
    mode,
    profilesQuery.isLoading,
    profilesQuery.isError,
    compareProfiles.length,
    effectiveCompareUserId,
    compareKnownPrivate,
    compareProfileQuery.isLoading,
    compareProfileQuery.data,
    compareHistoryQuery.isLoading,
    compareHasPermissionError,
    compareHistoryQuery.isError,
    compareHistoryQuery.data,
    compareExerciseDaily.length,
    isCompareOwner,
    activeExercise,
    selectedCompareUser?.display_name,
    mineUnavailable,
    errorMessage,
    noExerciseData,
  ])

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

            {mineUnavailable ? (
              <Typography className="muted">{errorMessage}</Typography>
            ) : noExerciseData ? (
              <Typography className="muted">No completed workout data yet. Finish workouts to see progress.</Typography>
            ) : (
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
            )}

            {mode === 'compare' ? (
              profilesQuery.isLoading ? (
                <Typography variant="body2" className="muted">
                  Loading users to compare...
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

            {mode === 'compare' && compareStatusMessage ? (
              <Typography variant="body2" className="muted">
                {compareStatusMessage}
              </Typography>
            ) : null}

            {!noExerciseData && !mineUnavailable ? (
              <>
                <Stack direction="row" spacing={0.7}>
                  <Paper className="card" elevation={0} sx={{ flex: 1, p: 0.7 }}>
                    <Typography variant="caption" className="muted">
                      Your best weight
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>{formatBestWeight(bestWeightMine)}</Typography>
                  </Paper>
                  {mode === 'compare' ? (
                    <Paper className="card" elevation={0} sx={{ flex: 1, p: 0.7 }}>
                      <Typography variant="caption" className="muted">
                        {selectedCompareUser?.display_name || 'User'} best
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }}>{formatBestWeight(bestWeightCompare)}</Typography>
                    </Paper>
                  ) : null}
                  <Paper className="card" elevation={0} sx={{ flex: 1, p: 0.7 }}>
                    <Typography variant="caption" className="muted">
                      Your sessions
                    </Typography>
                    <Typography sx={{ fontWeight: 700 }}>{mineDaily.length}</Typography>
                  </Paper>
                </Stack>

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
            ) : null}
          </>
        )}
      </Stack>
    </Paper>
  )
}
