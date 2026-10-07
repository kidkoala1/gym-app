import { useState } from 'react'
import { CircularProgress } from '@mui/material'
import { ActionSheet } from '../../../components/ActionSheet'
import { BottomSheet } from '../../../components/BottomSheet'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Icon } from '../../../components/Icon'
import { calendarDaysBetween, formatClock, startOfWeek } from '../../../lib/time'
import { useNow } from '../../../lib/useNow'
import type { WorkoutHistoryRow } from '../../../types/db'
import { WORKOUT_TITLE_SUGGESTIONS } from '../constants'
import { formatKg, formatSet, longDate, shortDate, timeOfDay } from '../format'
import type { WorkoutSummary } from '../useActiveWorkout'
import { isSetSaved, visibleExercises, type DraftWorkout } from '../workoutDraft'
import { sortedExercises, topSet } from '../workoutStats'
import { ExerciseCard } from './ExerciseCard'
import { ExercisePicker } from './ExercisePicker'
import { WorkoutRow } from './WorkoutRow'

type WorkoutTabProps = {
  userId: string
  workout: DraftWorkout | null
  resumePending: boolean
  syncError: string | null
  recentWorkouts: WorkoutHistoryRow[]
  exerciseNames: string[]
  startPending: boolean
  finishPending: boolean
  deletePending: boolean
  onStart: (title: string) => void
  onRename: (title: string) => void
  onAddExercise: (name: string) => void
  onSwapExercise: (exKey: string, name: string) => void
  onRemoveExercise: (exKey: string) => void
  onUpdateSet: (exKey: string, setKey: string, field: 'weight' | 'reps', value: string) => void
  onDeleteSet: (exKey: string, setKey: string) => void
  onSaveNow: () => void
  onFinish: () => Promise<WorkoutSummary | 'empty' | null>
  onDelete: () => Promise<boolean>
  onOpenPastWorkout: (workoutId: string) => void
}

export function WorkoutTab(props: WorkoutTabProps) {
  const [summary, setSummary] = useState<WorkoutSummary | null>(null)

  return (
    <>
      {props.workout ? (
        <ActiveWorkout {...props} workout={props.workout} onFinished={setSummary} />
      ) : props.resumePending ? (
        <div className="spinner-row">
          <CircularProgress size={26} aria-label="Loading" />
        </div>
      ) : (
        <IdleWorkout {...props} />
      )}

      <BottomSheet open={summary !== null} onClose={() => setSummary(null)}>
        {summary ? (
          <div className="summary">
            <div className="sum-icon">
              <Icon name="check" />
            </div>
            <h2>Workout saved</h2>
            <p className="muted">
              {summary.title} · {longDate(summary.startedAt)}
            </p>
            <div className="tiles two" style={{ width: '100%', textAlign: 'left' }}>
              <div className="tile">
                <div className="k">Duration</div>
                <div className="v">
                  {summary.durationMin}
                  <small>min</small>
                </div>
              </div>
              <div className="tile">
                <div className="k">Exercises</div>
                <div className="v">{summary.exerciseCount}</div>
              </div>
              <div className="tile">
                <div className="k">Sets</div>
                <div className="v">{summary.setCount}</div>
              </div>
              <div className="tile">
                <div className="k">Volume</div>
                <div className="v">{formatKg(summary.volumeKg)}</div>
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setSummary(null)}>
              Done
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </>
  )
}

function IdleWorkout({ recentWorkouts, startPending, onStart, onOpenPastWorkout }: WorkoutTabProps) {
  const now = useNow(60_000)
  const [title, setTitle] = useState('')
  const lastWorkout = recentWorkouts[0]

  const monday = new Date(startOfWeek(now))
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    const trained = recentWorkouts.some((w) => calendarDaysBetween(w.started_at, date) === 0)
    const offset = calendarDaysBetween(now, date)
    return { date, trained, isToday: offset === 0, isFuture: offset > 0 }
  })
  const trainedCount = days.filter((day) => day.trained).length

  const lastLabel = lastWorkout
    ? (() => {
        const ago = calendarDaysBetween(lastWorkout.started_at, now)
        if (ago <= 0) return 'today'
        if (ago === 1) return 'yesterday'
        if (ago < 7) return `on ${new Date(lastWorkout.started_at).toLocaleDateString('en-GB', { weekday: 'long' })}`
        return `on ${shortDate(lastWorkout.started_at)}`
      })()
    : ''

  return (
    <>
      <header className="lt">
        <p className="eyebrow">{longDate(now)}</p>
        <h1>Workout</h1>
      </header>
      <div className="stack">
        <section className="card">
          <div className="card-head">
            <h2>This week</h2>
            <span className="muted sm">
              {trainedCount} {trainedCount === 1 ? 'workout' : 'workouts'}
            </span>
          </div>
          <div className="week">
            {days.map((day, i) => (
              <div
                key={i}
                className={['day', day.trained && 'on', day.isToday && 'today', day.isFuture && 'future'].filter(Boolean).join(' ')}
              >
                {'MTWTFSS'[i]}
                <b>{day.date.getDate()}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Start a workout</h2>
          <div className="chips">
            {WORKOUT_TITLE_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chip"
                aria-pressed={suggestion.toLowerCase() === title.trim().toLowerCase()}
                onClick={() => setTitle(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <input
            className="field"
            placeholder="Or type a name"
            autoComplete="off"
            enterKeyHint="go"
            aria-label="Workout name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !startPending) onStart(title)
            }}
          />
          <button type="button" className="btn btn-primary" onClick={() => onStart(title)} disabled={startPending}>
            Start workout
          </button>
        </section>

        {lastWorkout ? (
          <section className="section">
            <div className="section-label">Last workout · {lastLabel}</div>
            <div className="group hist">
              <WorkoutRow workout={lastWorkout} onOpen={() => onOpenPastWorkout(lastWorkout.id)} />
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}

type PickerState = { mode: 'add' } | { mode: 'swap'; exKey: string } | null
type ConfirmState = { kind: 'delete-workout' } | { kind: 'empty-finish' } | { kind: 'remove-exercise'; exKey: string } | null

function ActiveWorkout({
  userId,
  workout,
  syncError,
  recentWorkouts,
  exerciseNames,
  finishPending,
  deletePending,
  onRename,
  onAddExercise,
  onSwapExercise,
  onRemoveExercise,
  onUpdateSet,
  onDeleteSet,
  onSaveNow,
  onFinish,
  onDelete,
  onFinished,
}: WorkoutTabProps & { workout: DraftWorkout; onFinished: (summary: WorkoutSummary) => void }) {
  const now = useNow(1000)
  const [renameDraft, setRenameDraft] = useState<string | null>(null)
  const [workoutMenuOpen, setWorkoutMenuOpen] = useState(false)
  const [exerciseMenuKey, setExerciseMenuKey] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickerState>(null)
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  const exercises = visibleExercises(workout)
  const savedSetCount = exercises.reduce((sum, exercise) => sum + exercise.sets.filter(isSetSaved).length, 0)
  const menuExercise = exercises.find((exercise) => exercise.key === exerciseMenuKey)
  const removeTarget = confirm?.kind === 'remove-exercise' ? exercises.find((e) => e.key === confirm.exKey) : undefined

  // Past workouts only; the live one is in the list too once it has sets.
  const pastWorkouts = recentWorkouts.filter((w) => w.id !== workout.id)
  const inWorkout = new Set(exercises.map((exercise) => exercise.name.toLowerCase()))
  const sameTitle = workout.title
    ? pastWorkouts.find((w) => w.title?.trim().toLowerCase() === workout.title?.trim().toLowerCase())
    : undefined
  const suggested = sameTitle
    ? {
        label: `From your last ${sameTitle.title} · ${shortDate(sameTitle.started_at)}`,
        names: sortedExercises(sameTitle.workout_exercises)
          .map((e) => e.exercise_name)
          .filter((name) => !inWorkout.has(name.toLowerCase())),
      }
    : {
        label: 'Recent',
        names: [...new Set(pastWorkouts.slice(0, 4).flatMap((w) => sortedExercises(w.workout_exercises).map((e) => e.exercise_name)))]
          .filter((name) => !inWorkout.has(name.toLowerCase()))
          .slice(0, 6),
      }
  const describe = (name: string) => {
    for (const past of pastWorkouts) {
      const match = past.workout_exercises.find((e) => e.exercise_name.toLowerCase() === name.toLowerCase())
      const best = match ? topSet(match.workout_sets) : null
      if (best) return formatSet(Number(best.weight_kg), Number(best.reps))
    }
    return undefined
  }

  async function finish() {
    const result = await onFinish()
    if (result === 'empty') setConfirm({ kind: 'empty-finish' })
    else if (result) onFinished(result)
  }

  return (
    <>
      <div className="wbar">
        <button type="button" className="wtitle" onClick={() => setRenameDraft(workout.title ?? '')} aria-label="Rename workout">
          <span className="wt">
            <span>{workout.title || 'Workout'}</span>
            <Icon name="chevronDown" />
          </span>
          <span className="wsub">
            Started {timeOfDay(workout.startedAt)} · {savedSetCount} {savedSetCount === 1 ? 'set' : 'sets'} saved
          </span>
        </button>
        <span className="elapsed" aria-label="Time since the workout started">
          {formatClock(now - new Date(workout.startedAt).getTime())}
        </span>
        <button type="button" className="icon-btn" onClick={() => setWorkoutMenuOpen(true)} aria-label="Workout options">
          <Icon name="more" />
        </button>
      </div>

      <div className="stack tight">
        {syncError ? (
          <div className="banner" role="status">
            <Icon name="alert" className="chev" />
            <span>Some sets aren’t saved yet ({syncError}). Retrying automatically.</span>
          </div>
        ) : null}

        {exercises.length === 0 ? (
          <section className="card">
            <h2>No exercises yet</h2>
            <p className="muted">
              Add your first exercise. The weight starts at what you lifted last time, so you usually only type the reps.
            </p>
          </section>
        ) : (
          exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.key}
              userId={userId}
              workoutId={workout.id}
              exercise={exercise}
              onChangeSet={(setKey, field, value) => onUpdateSet(exercise.key, setKey, field, value)}
              onDeleteSet={(setKey) => onDeleteSet(exercise.key, setKey)}
              onBlur={onSaveNow}
              onOpenMenu={() => setExerciseMenuKey(exercise.key)}
            />
          ))
        )}

        <button type="button" className="btn btn-tinted" onClick={() => setPicker({ mode: 'add' })}>
          <Icon name="plus" /> Add exercise
        </button>
        <div className="finish-zone">
          <button type="button" className="btn btn-plain" onClick={() => void finish()} disabled={finishPending}>
            Finish workout
          </button>
          <p className="footnote center">
            A set saves itself once it has weight and reps, and the next row appears. Swipe a set left to delete it.
          </p>
        </div>
      </div>

      <ExercisePicker
        open={picker !== null}
        title={picker?.mode === 'swap' ? 'Swap exercise' : 'Add exercise'}
        names={exerciseNames}
        suggested={suggested}
        describe={describe}
        onClose={() => setPicker(null)}
        onPick={(name) => {
          if (picker?.mode === 'swap') onSwapExercise(picker.exKey, name)
          else onAddExercise(name)
          setPicker(null)
        }}
      />

      <BottomSheet
        open={renameDraft !== null}
        onClose={() => setRenameDraft(null)}
        title="Workout name"
        left={
          <button type="button" onClick={() => setRenameDraft(null)}>
            Cancel
          </button>
        }
        right={
          <button
            type="button"
            onClick={() => {
              onRename(renameDraft ?? '')
              setRenameDraft(null)
            }}
          >
            Save
          </button>
        }
      >
        <div className="stack-sm">
          <input
            className="field"
            placeholder="Workout name"
            autoComplete="off"
            enterKeyHint="done"
            aria-label="Workout name"
            value={renameDraft ?? ''}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRename(renameDraft ?? '')
                setRenameDraft(null)
              }
            }}
          />
          <div className="chips">
            {WORKOUT_TITLE_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="chip"
                aria-pressed={suggestion.toLowerCase() === (renameDraft ?? '').trim().toLowerCase()}
                onClick={() => setRenameDraft(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>

      <ActionSheet
        open={workoutMenuOpen}
        onClose={() => setWorkoutMenuOpen(false)}
        items={[
          { label: 'Rename workout', onSelect: () => setRenameDraft(workout.title ?? '') },
          { label: 'Delete workout', destructive: true, onSelect: () => setConfirm({ kind: 'delete-workout' }) },
        ]}
      />

      <ActionSheet
        open={menuExercise !== undefined}
        title={menuExercise?.name}
        onClose={() => setExerciseMenuKey(null)}
        items={
          menuExercise
            ? [
                { label: 'Swap exercise', onSelect: () => setPicker({ mode: 'swap', exKey: menuExercise.key }) },
                {
                  label: 'Remove exercise',
                  destructive: true,
                  onSelect: () => setConfirm({ kind: 'remove-exercise', exKey: menuExercise.key }),
                },
              ]
            : []
        }
      />

      <ConfirmDialog
        open={confirm?.kind === 'delete-workout'}
        title="Delete this workout?"
        cancelLabel="Keep it"
        confirmLabel="Delete"
        destructive
        confirmDisabled={deletePending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (await onDelete()) setConfirm(null)
        }}
      >
        The workout and its {savedSetCount} saved {savedSetCount === 1 ? 'set' : 'sets'} will be removed. This can’t be undone.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === 'empty-finish'}
        title="Nothing logged yet"
        cancelLabel="Keep going"
        confirmLabel="Delete"
        destructive
        confirmDisabled={deletePending}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (await onDelete()) setConfirm(null)
        }}
      >
        Fill in at least one set, or delete this workout.
      </ConfirmDialog>

      <ConfirmDialog
        open={removeTarget !== undefined}
        title={`Remove ${removeTarget?.name ?? 'exercise'}?`}
        confirmLabel="Remove"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (removeTarget) onRemoveExercise(removeTarget.key)
          setConfirm(null)
        }}
      >
        {removeTarget && removeTarget.sets.some(isSetSaved)
          ? 'Its saved sets will be deleted from this workout.'
          : 'It has no saved sets yet.'}
      </ConfirmDialog>
    </>
  )
}
