import { useMemo, useState } from 'react'
import { CircularProgress } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { ActionSheet } from '../../../components/ActionSheet'
import { NavRow, SegmentedControl } from '../../../components/Controls'
import { getProfile } from '../../profile/api'
import { getProgressSeries, searchPublicProfiles } from '../api'
import { dayDate, formatKg } from '../format'
import { formatWeight } from '../workoutDraft'
import type { ProgressSeriesRow } from '../../../types/db'
import { ExercisePicker } from './ExercisePicker'
import { ProgressChart, type ChartPoint } from './ProgressChart'

type ProgressTabProps = {
  exerciseNames: string[]
  exerciseNamesLoading: boolean
  exerciseNamesErrorMessage?: string | null
  userId: string
}

type RangeKey = '30d' | '90d' | '365d' | 'all'
type ModeKey = 'mine' | 'compare'
type MetricKey = 'maxWeight' | 'totalVolume' | 'totalReps'

type DailyProgressEntry = {
  time: number
  maxWeight: number
  totalVolume: number
  totalReps: number
}

const RANGE_OPTIONS: Array<{ value: RangeKey; label: string }> = [
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '365d', label: '1Y' },
  { value: 'all', label: 'All' },
]
const METRIC_OPTIONS: Array<{ value: MetricKey; label: string }> = [
  { value: 'maxWeight', label: 'Max weight' },
  { value: 'totalVolume', label: 'Volume' },
  { value: 'totalReps', label: 'Reps' },
]
const EMPTY_DAILY_PROGRESS: DailyProgressEntry[] = []

function getRangeDays(range: RangeKey): number | null {
  if (range === 'all') return null
  return range === '30d' ? 30 : range === '90d' ? 90 : 365
}

/** bucket_date is a calendar date; read it as local midnight so it stays on the same day. */
function dateKeyToTime(bucketDate: string): number {
  const [y, m, d] = bucketDate.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

function mapProgressSeriesToDailyProgress(series: ProgressSeriesRow[]): DailyProgressEntry[] {
  return series
    .map((point) => ({
      time: dateKeyToTime(point.bucket_date),
      maxWeight: Number(point.max_weight),
      totalVolume: Number(point.total_volume),
      totalReps: Number(point.total_reps),
    }))
    .filter((p) => Number.isFinite(p.maxWeight) && Number.isFinite(p.totalVolume) && Number.isFinite(p.totalReps))
    .sort((a, b) => a.time - b.time)
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
  return maybe.message.trim() || null
}

async function getExerciseProgressDaily(targetUserId: string, exerciseName: string, range: RangeKey) {
  const series = await getProgressSeries(targetUserId, exerciseName, getRangeDays(range))
  return mapProgressSeriesToDailyProgress(series)
}

function formatMetric(metric: MetricKey, value: number): string {
  if (metric === 'maxWeight') return `${formatWeight(value)} kg`
  if (metric === 'totalVolume') return formatKg(value)
  return `${value} reps`
}

function KgTile({ label, value, tone }: { label: string; value: number | null; tone?: 'signed' }) {
  const sign = tone === 'signed' && value !== null ? (value > 0 ? '+' : value < 0 ? '−' : '') : ''
  const className = tone === 'signed' && value ? (value > 0 ? 'v up' : 'v down') : 'v'
  return (
    <div className="tile">
      <div className="k">{label}</div>
      <div className={className}>
        {value === null ? (
          '—'
        ) : (
          <>
            {sign}
            {formatWeight(tone === 'signed' ? Math.abs(value) : value)}
            <small>kg</small>
          </>
        )}
      </div>
    </div>
  )
}

export function ProgressTab({ exerciseNames, exerciseNamesLoading, exerciseNamesErrorMessage, userId }: ProgressTabProps) {
  const [selectedExercise, setSelectedExercise] = useState('')
  const [range, setRange] = useState<RangeKey>('90d')
  const [mode, setMode] = useState<ModeKey>('mine')
  const [metric, setMetric] = useState<MetricKey>('maxWeight')
  const [selectedCompareUserId, setSelectedCompareUserId] = useState('')
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false)
  const [comparePickerOpen, setComparePickerOpen] = useState(false)
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
  const compareName = selectedCompareUser?.display_name || 'User'

  const compareProfileQuery = useQuery({
    queryKey: ['profile-visibility', effectiveCompareUserId],
    queryFn: () => getProfile(effectiveCompareUserId),
    enabled: mode === 'compare' && Boolean(effectiveCompareUserId),
  })

  const compareKnownPrivate =
    mode === 'compare' &&
    Boolean(effectiveCompareUserId) &&
    compareProfileQuery.isSuccess &&
    compareProfileQuery.data?.is_progress_public === false

  const mineProgressQuery = useQuery({
    queryKey: ['exercise-progress', userId, activeExercise, range],
    queryFn: () => getExerciseProgressDaily(userId, activeExercise, range),
    enabled: Boolean(activeExercise) && !noExerciseData,
  })

  const compareProgressQuery = useQuery({
    queryKey: ['exercise-progress', effectiveCompareUserId, activeExercise, range],
    queryFn: () => getExerciseProgressDaily(effectiveCompareUserId, activeExercise, range),
    enabled:
      mode === 'compare' &&
      Boolean(effectiveCompareUserId) &&
      Boolean(activeExercise) &&
      !compareKnownPrivate &&
      !mineProgressQuery.isError &&
      !noExerciseData,
  })

  const mine = mineProgressQuery.data ?? EMPTY_DAILY_PROGRESS
  const other = mode === 'compare' ? (compareProgressQuery.data ?? EMPTY_DAILY_PROGRESS) : EMPTY_DAILY_PROGRESS

  const bestMine = mine.length > 0 ? Math.max(...mine.map((p) => p.maxWeight)) : null
  const bestOther = other.length > 0 ? Math.max(...other.map((p) => p.maxWeight)) : null
  const change = mine.length > 1 ? mine[mine.length - 1].maxWeight - mine[0].maxWeight : null
  const toPoints = (entries: DailyProgressEntry[]): ChartPoint[] => entries.map((p) => ({ time: p.time, value: p[metric] }))

  let compareStatus = ''
  if (mode === 'compare') {
    const hasPermissionError =
      isPermissionDeniedError(compareProgressQuery.error) || isPermissionDeniedError(compareProfileQuery.error)
    if (profilesQuery.isLoading) compareStatus = 'Loading people to compare with…'
    else if (profilesQuery.isError) compareStatus = 'Could not load people to compare with right now.'
    else if (compareProfiles.length === 0) compareStatus = 'Nobody has made their progress public yet.'
    else if (compareKnownPrivate) compareStatus = `${compareName}’s progress is private.`
    else if (hasPermissionError) compareStatus = `You don’t have permission to see ${compareName}’s progress.`
    else if (compareProgressQuery.isError)
      compareStatus = getErrorMessage(compareProgressQuery.error) ?? 'Could not load their progress. Try again.'
    else if (compareProgressQuery.isSuccess && other.length === 0)
      compareStatus = `${compareName} hasn’t logged ${activeExercise} in this period.`
  }

  const chartKey = `${mode}-${activeExercise}-${range}-${metric}-${effectiveCompareUserId}`

  return (
    <>
      <header className="lt">
        <h1>Progress</h1>
      </header>

      {exerciseNamesLoading ? (
        <div className="spinner-row">
          <CircularProgress size={26} aria-label="Loading" />
        </div>
      ) : exerciseNamesErrorMessage ? (
        <p className="footnote">{exerciseNamesErrorMessage}</p>
      ) : noExerciseData ? (
        <section className="card">
          <h2>No workouts yet</h2>
          <p className="muted">Log a few workouts and your progress shows up here.</p>
        </section>
      ) : (
        <div className="stack">
          <div className="stack-sm">
            <SegmentedControl
              label="Whose progress"
              options={[
                { value: 'mine', label: 'Mine' },
                { value: 'compare', label: 'Compare' },
              ]}
              value={mode}
              onChange={setMode}
            />
            <div className="group">
              <NavRow value={activeExercise} onClick={() => setExercisePickerOpen(true)}>
                Exercise
              </NavRow>
              {mode === 'compare' && compareProfiles.length > 0 ? (
                <NavRow value={compareName} onClick={() => setComparePickerOpen(true)}>
                  Compare with
                </NavRow>
              ) : null}
            </div>
            <SegmentedControl label="Period" options={RANGE_OPTIONS} value={range} onChange={setRange} />
          </div>

          {mineProgressQuery.isLoading ? (
            <div className="spinner-row">
              <CircularProgress size={26} aria-label="Loading" />
            </div>
          ) : mineProgressQuery.isError ? (
            <p className="footnote">{getErrorMessage(mineProgressQuery.error) ?? 'Could not load your progress. Try again.'}</p>
          ) : mine.length === 0 ? (
            <section className="card">
              <h2>No sessions in this period</h2>
              <p className="muted">Pick a longer period or another exercise.</p>
            </section>
          ) : (
            <>
              <div className="tiles">
                {mode === 'compare' ? (
                  <>
                    <KgTile label="You" value={bestMine} />
                    <KgTile label={compareName} value={bestOther} />
                    <KgTile label="Gap" value={bestMine !== null && bestOther !== null ? bestMine - bestOther : null} tone="signed" />
                  </>
                ) : (
                  <>
                    <KgTile label="Best" value={bestMine} />
                    <KgTile label="Change" value={change} tone="signed" />
                    <div className="tile">
                      <div className="k">Sessions</div>
                      <div className="v">{mine.length}</div>
                    </div>
                  </>
                )}
              </div>

              <section className="chart-card">
                <SegmentedControl label="Chart" options={METRIC_OPTIONS} value={metric} onChange={setMetric} small />
                <ProgressChart
                  key={chartKey}
                  mine={toPoints(mine)}
                  other={toPoints(other)}
                  otherName={mode === 'compare' ? compareName : undefined}
                  formatValue={(value) => formatMetric(metric, value)}
                  label={`${METRIC_OPTIONS.find((o) => o.value === metric)?.label} for ${activeExercise}`}
                />
                {mode === 'compare' && other.length > 0 ? (
                  <div className="legend">
                    <span>
                      <i className="mine" />
                      You
                    </span>
                    <span>
                      <i className="other" />
                      {compareName}
                    </span>
                  </div>
                ) : null}
                {compareStatus ? <p className="footnote">{compareStatus}</p> : null}
              </section>

              <section className="section">
                <div className="section-label">Recent sessions</div>
                <div className="group">
                  {[...mine]
                    .reverse()
                    .slice(0, 5)
                    .map((entry) => (
                      <div className="row" key={entry.time}>
                        <span className="grow">{dayDate(entry.time)}</span>
                        <span className="num">{formatWeight(entry.maxWeight)} kg</span>
                        <span className="value sm">{formatKg(entry.totalVolume)}</span>
                      </div>
                    ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}

      <ExercisePicker
        open={exercisePickerOpen}
        title="Exercise"
        names={exerciseNames}
        current={activeExercise}
        allowNew={false}
        onClose={() => setExercisePickerOpen(false)}
        onPick={(name) => {
          setSelectedExercise(name)
          setExercisePickerOpen(false)
        }}
      />

      <ActionSheet
        open={comparePickerOpen}
        title="Compare with"
        onClose={() => setComparePickerOpen(false)}
        items={compareProfiles.map((profile) => ({
          label: profile.display_name || 'User',
          onSelect: () => setSelectedCompareUserId(profile.id),
        }))}
      />
    </>
  )
}
