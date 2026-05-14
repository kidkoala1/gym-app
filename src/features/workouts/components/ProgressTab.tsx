import { Box, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { getProfile } from '../../profile/api'
import {
  getProgressSeries,
  listExerciseInsightHistory,
  listLoggedExerciseNames,
  listWorkoutHistory,
  searchPublicProfiles,
} from '../api'
import { resolveCanonicalExerciseName } from '../defaultExercises'
import type { ExerciseInsightHistoryRow, ProgressSeriesRow, WorkoutHistoryRow } from '../../../types/db'

type ProgressTabProps = {
  exerciseNames: string[]
  exerciseNamesLoading: boolean
  exerciseNamesErrorMessage?: string | null
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
const EMPTY_DAILY_PROGRESS: DailyProgressEntry[] = []

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

function buildExerciseDailyProgress(
  workouts: Array<Pick<WorkoutHistoryRow | ExerciseInsightHistoryRow, 'started_at' | 'workout_exercises'>>,
  exerciseName: string,
  range: RangeKey,
  matchingExerciseNames: string[] = [exerciseName],
): DailyProgressEntry[] {
  if (!exerciseName) return []
  const cutoff = getRangeCutoff(range)
  const targetNames = new Set(matchingExerciseNames.map(normalizeExerciseName))
  const byDate = new Map<string, DailyProgressEntry>()

  workouts.forEach((workout) => {
    const timestamp = new Date(workout.started_at).getTime()
    if (cutoff !== null && timestamp < cutoff) return

    const matching = (workout.workout_exercises ?? []).filter(
      (exercise) => targetNames.has(normalizeExerciseName(exercise.exercise_name)),
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

function buildMatchingExerciseNames(
  selectedExercise: string,
  knownExerciseNames: string[],
  candidateExerciseNames: string[],
): string[] {
  const canonicalSelected = resolveCanonicalExerciseName(selectedExercise, knownExerciseNames)
  const targetName = normalizeExerciseName(canonicalSelected || selectedExercise)
  const names = new Map<string, string>()

  for (const name of [selectedExercise, canonicalSelected, ...candidateExerciseNames]) {
    const trimmed = name.trim()
    if (!trimmed) continue

    const canonical = resolveCanonicalExerciseName(trimmed, knownExerciseNames)
    if (normalizeExerciseName(canonical || trimmed) === targetName || normalizeExerciseName(trimmed) === targetName) {
      names.set(normalizeExerciseName(trimmed), trimmed)
      if (canonical) names.set(normalizeExerciseName(canonical), canonical)
    }
  }

  return [...names.values()]
}

function mapProgressSeriesToDailyProgress(series: ProgressSeriesRow[]): DailyProgressEntry[] {
  return series
    .map((point) => {
      const dateKey = toDateKey(point.bucket_date)
      return {
        dateKey,
        dateLabel: formatDateLabel(dateKey),
        maxWeight: Number(point.max_weight),
        totalVolume: Number(point.total_volume),
        totalReps: Number(point.total_reps),
      }
    })
    .filter((point) => {
      return (
        Number.isFinite(point.maxWeight) &&
        Number.isFinite(point.totalVolume) &&
        Number.isFinite(point.totalReps)
      )
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
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

async function getExerciseProgressDaily(
  targetUserId: string,
  exerciseName: string,
  range: RangeKey,
  fallback:
    | { type: 'full-history' }
    | { type: 'matching-exercises'; exerciseNames: string[] }
    | { type: 'none' },
): Promise<DailyProgressEntry[]> {
  let rpcProgress: DailyProgressEntry[] = []

  try {
    const series = await getProgressSeries(targetUserId, exerciseName, getRangeDays(range))
    rpcProgress = mapProgressSeriesToDailyProgress(series)
  } catch (error) {
    if (isPermissionDeniedError(error)) throw error
  }

  if (fallback.type === 'matching-exercises') {
    const history = await listExerciseInsightHistory(targetUserId, fallback.exerciseNames)
    const fallbackProgress = buildExerciseDailyProgress(history, exerciseName, range, fallback.exerciseNames)

    if (fallbackProgress.length > 0) return fallbackProgress
    return rpcProgress
  }

  if (rpcProgress.length > 0) return rpcProgress

  if (fallback.type === 'none') return []

  if (fallback.type === 'full-history') {
    const history = await listWorkoutHistory(targetUserId)
    return buildExerciseDailyProgress(history, exerciseName, range)
  }

  return []
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

export function ProgressTab({
  exerciseNames,
  exerciseNamesLoading,
  exerciseNamesErrorMessage,
  userId,
}: ProgressTabProps) {
  const [selectedExercise, setSelectedExercise] = useState('')
  const [range, setRange] = useState<RangeKey>('90d')
  const [mode, setMode] = useState<ModeKey>('mine')
  const [selectedCompareUserId, setSelectedCompareUserId] = useState('')
  const activeExercise = selectedExercise || exerciseNames[0] || ''
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

  const compareKnownPublic =
    mode === 'compare' &&
    Boolean(effectiveCompareUserId) &&
    (isCompareOwner || (compareProfileQuery.isSuccess && compareProfileQuery.data?.is_progress_public === true))

  const compareExerciseNamesQuery = useQuery({
    queryKey: ['logged-exercise-names', effectiveCompareUserId],
    queryFn: () => listLoggedExerciseNames(effectiveCompareUserId),
    enabled: compareKnownPublic,
  })

  const compareMatchingExerciseNames = useMemo(() => {
    return buildMatchingExerciseNames(
      activeExercise,
      [...exerciseNames, ...(compareExerciseNamesQuery.data ?? [])],
      compareExerciseNamesQuery.data ?? [],
    )
  }, [activeExercise, compareExerciseNamesQuery.data, exerciseNames])

  const ownMatchingExerciseNames = useMemo(() => {
    return buildMatchingExerciseNames(activeExercise, exerciseNames, exerciseNames)
  }, [activeExercise, exerciseNames])

  const mineProgressQuery = useQuery({
    queryKey: ['exercise-progress', userId, activeExercise, range, ownMatchingExerciseNames],
    queryFn: () =>
      getExerciseProgressDaily(userId, activeExercise, range, {
        type: 'matching-exercises',
        exerciseNames: ownMatchingExerciseNames,
      }),
    enabled: Boolean(activeExercise) && !noExerciseData,
  })
  const mineUnavailable = mineProgressQuery.isError

  const compareProgressQuery = useQuery({
    queryKey: ['exercise-progress', effectiveCompareUserId, activeExercise, range, compareMatchingExerciseNames],
    queryFn: () =>
      getExerciseProgressDaily(effectiveCompareUserId, activeExercise, range, {
        type: compareKnownPublic ? 'matching-exercises' : 'none',
        exerciseNames: compareMatchingExerciseNames,
      }),
    enabled:
      mode === 'compare' &&
      Boolean(effectiveCompareUserId) &&
      Boolean(activeExercise) &&
      !compareKnownPrivate &&
      (!compareKnownPublic || !compareExerciseNamesQuery.isLoading) &&
      !mineUnavailable &&
      !noExerciseData,
  })

  const mineExerciseDaily = mineProgressQuery.data ?? EMPTY_DAILY_PROGRESS
  const compareExerciseDaily = compareProgressQuery.data ?? EMPTY_DAILY_PROGRESS

  const mineDaily = mineExerciseDaily

  const {
    bestWeightCompare,
    bestWeightMine,
    maxWeightPoints,
    repsPoints,
    volumePoints,
  } = useMemo(() => {
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

    return {
      bestWeightMine:
        mineMaxWeightSeries.length > 0 ? Math.max(...mineMaxWeightSeries.map((p) => p.value)) : null,
      bestWeightCompare:
        compareMaxWeightSeries.length > 0
          ? Math.max(...compareMaxWeightSeries.map((p) => p.value))
          : null,
      maxWeightPoints: combineSeries(mineMaxWeightSeries, compareMaxWeightSeries),
      volumePoints: combineSeries(mineVolumeSeries, compareVolumeSeries),
      repsPoints: combineSeries(mineRepsSeries, compareRepsSeries),
    }
  }, [compareExerciseDaily, mineDaily, mode])

  const compareHasPermissionError = isPermissionDeniedError(compareProgressQuery.error) || isPermissionDeniedError(compareProfileQuery.error)
  const compareStatusMessage = useMemo(() => {
    if (mode !== 'compare') return ''
    if (mineUnavailable) return getErrorMessage(mineProgressQuery.error) ?? 'Unable to load your progress.'
    if (exerciseNamesLoading) return 'Loading exercises...'
    if (exerciseNamesErrorMessage) return exerciseNamesErrorMessage
    if (noExerciseData) return 'No completed workout data yet. Finish workouts to compare.'
    if (profilesQuery.isLoading) return 'Loading users to compare...'
    if (profilesQuery.isError) return 'Unable to load users to compare right now.'
    if (compareProfiles.length === 0) return 'No public users available to compare yet.'
    if (!effectiveCompareUserId) return 'Select a user to compare.'
    if (compareKnownPrivate) return "This user's progress is private."
    if (compareProfileQuery.isLoading) return 'Checking profile visibility...'
    if (compareKnownPublic && compareExerciseNamesQuery.isLoading) return 'Loading compare data...'
    if (compareProgressQuery.isLoading) return 'Loading compare data...'
    if (compareHasPermissionError) return "You do not have permission to view this user's progress."
    if (compareProgressQuery.isError) {
      return getErrorMessage(compareProgressQuery.error) ?? 'Unable to load compare progress. Try again.'
    }
    if (compareExerciseDaily.length === 0) {
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
    compareKnownPublic,
    compareExerciseNamesQuery.isLoading,
    compareProgressQuery.isLoading,
    compareHasPermissionError,
    compareProgressQuery.error,
    compareProgressQuery.isError,
    compareExerciseDaily.length,
    isCompareOwner,
    activeExercise,
    selectedCompareUser?.display_name,
    mineUnavailable,
    mineProgressQuery.error,
    noExerciseData,
    exerciseNamesErrorMessage,
    exerciseNamesLoading,
  ])

  return (
    <Paper className="panel" elevation={0}>
      <Stack spacing={1.1}>
        <Typography variant="h6" sx={{ fontSize: '1rem' }}>
          Progress
        </Typography>

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
              <Typography className="muted">
                {getErrorMessage(mineProgressQuery.error) ?? 'Unable to load your progress.'}
              </Typography>
            ) : exerciseNamesLoading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}>
                <CircularProgress size={26} />
              </Box>
            ) : exerciseNamesErrorMessage ? (
              <Typography className="muted">{exerciseNamesErrorMessage}</Typography>
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

            {mineProgressQuery.isLoading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}>
                <CircularProgress size={26} />
              </Box>
            ) : mineProgressQuery.isError ? (
              <Typography variant="body2" className="muted">
                {getErrorMessage(mineProgressQuery.error) ?? 'Unable to load progress. Try again.'}
              </Typography>
            ) : !noExerciseData && !mineUnavailable ? (
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
      </Stack>
    </Paper>
  )
}
