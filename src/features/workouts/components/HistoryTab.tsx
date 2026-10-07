import { useState } from 'react'
import { CircularProgress } from '@mui/material'
import { BottomSheet } from '../../../components/BottomSheet'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Icon } from '../../../components/Icon'
import { useNow } from '../../../lib/useNow'
import type { WorkoutHistoryRow } from '../../../types/db'
import { formatKg, formatSet, longDate, timeOfDay } from '../format'
import type { useWorkoutHistory } from '../useWorkoutHistory'
import { visibleExercises } from '../workoutDraft'
import {
  groupByWeek,
  sortedExercises,
  topSet,
  weekLabel,
  workoutDisplayTitle,
  workoutSetCount,
  workoutVolume,
} from '../workoutStats'
import { ExercisePicker } from './ExercisePicker'
import { SetTable } from './SetTable'
import { WorkoutRow } from './WorkoutRow'

type HistoryTabProps = {
  history: ReturnType<typeof useWorkoutHistory>
  exerciseNames: string[]
}

export function HistoryTab({ history, exerciseNames }: HistoryTabProps) {
  const now = useNow(60_000)
  const groups = groupByWeek(history.workouts)
  const deleteTarget = history.deleteTarget

  return (
    <>
      <header className="lt">
        <h1>History</h1>
      </header>

      {history.isLoading ? (
        <div className="spinner-row">
          <CircularProgress size={26} aria-label="Loading" />
        </div>
      ) : history.errorMessage ? (
        <p className="footnote">{history.errorMessage}</p>
      ) : history.workouts.length === 0 ? (
        <section className="card">
          <h2>No workouts yet</h2>
          <p className="muted">Workouts you log show up here, grouped by week.</p>
        </section>
      ) : (
        <div className="stack">
          {groups.map((group) => (
            <section className="section" key={group.weekStart}>
              <div className="section-label">
                {weekLabel(group.weekStart, now)} · {group.workouts.length} {group.workouts.length === 1 ? 'workout' : 'workouts'}
              </div>
              <div className="group hist">
                {group.workouts.map((workout) => (
                  <WorkoutRow key={workout.id} workout={workout} onOpen={() => history.openDetail(workout.id)} />
                ))}
              </div>
            </section>
          ))}
          {history.hasMore ? (
            <button type="button" className="btn btn-tinted" onClick={history.loadMore} disabled={history.isLoadingMore}>
              {history.isLoadingMore ? 'Loading…' : 'Show older workouts'}
            </button>
          ) : null}
        </div>
      )}

      <WorkoutDetailSheet history={history} exerciseNames={exerciseNames} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this workout?"
        confirmLabel="Delete"
        destructive
        confirmDisabled={history.deletePending}
        onCancel={history.cancelDelete}
        onConfirm={() => void history.confirmDelete()}
      >
        {deleteTarget
          ? `${workoutDisplayTitle(deleteTarget)} on ${longDate(deleteTarget.started_at)} and its ${workoutSetCount(deleteTarget)} sets will be removed. This can’t be undone.`
          : null}
      </ConfirmDialog>
    </>
  )
}

function WorkoutDetailSheet({ history, exerciseNames }: HistoryTabProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const workout = history.openWorkout
  const edit = history.edit

  const header = edit
    ? {
        title: 'Edit workout',
        left: (
          <button type="button" onClick={history.cancelEdit}>
            Cancel
          </button>
        ),
        right: (
          <button type="button" onClick={() => void history.saveEdit()} disabled={history.isSaving}>
            Save
          </button>
        ),
      }
    : {
        title: workout ? workoutDisplayTitle(workout) : '',
        left: (
          <button type="button" onClick={history.closeDetail}>
            Close
          </button>
        ),
        right: (
          <button type="button" onClick={history.beginEdit} disabled={!workout}>
            Edit
          </button>
        ),
      }

  return (
    <>
      <BottomSheet open={workout !== null} onClose={history.closeDetail} tall {...header}>
        {workout && edit ? (
          <div className="stack tight">
            <input
              className="field"
              placeholder="Workout name"
              autoComplete="off"
              aria-label="Workout name"
              value={edit.titleInput}
              onChange={(e) => history.setTitleInput(e.target.value)}
            />
            {visibleExercises(edit.draft).map((exercise) => (
              <article className="ex" key={exercise.key} aria-label={exercise.name}>
                <div className="edit-name">
                  <input
                    className="field"
                    autoComplete="off"
                    aria-label="Exercise name"
                    value={exercise.name}
                    onChange={(e) => history.renameExercise(exercise.key, e.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => history.removeExercise(exercise.key)}
                    aria-label={`Remove ${exercise.name}`}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
                <SetTable
                  exercise={exercise}
                  showSaved={false}
                  onChange={(setKey, field, value) => history.updateSet(exercise.key, setKey, field, value)}
                  onDelete={(setKey) => history.deleteSet(exercise.key, setKey)}
                />
              </article>
            ))}
            <button type="button" className="btn btn-tinted" onClick={() => setPickerOpen(true)}>
              <Icon name="plus" /> Add exercise
            </button>
            <p className="footnote center">
              Swipe a set left to delete it. Rows without reps are skipped. Nothing changes until you tap Save.
            </p>
          </div>
        ) : workout ? (
          <WorkoutDetails workout={workout} onDelete={() => history.requestDelete(workout.id)} />
        ) : null}
      </BottomSheet>

      <ExercisePicker
        open={pickerOpen}
        title="Add exercise"
        names={exerciseNames}
        onClose={() => setPickerOpen(false)}
        onPick={(name) => {
          history.addExercise(name)
          setPickerOpen(false)
        }}
      />
    </>
  )
}

function WorkoutDetails({ workout, onDelete }: { workout: WorkoutHistoryRow; onDelete: () => void }) {
  const exercises = sortedExercises(workout.workout_exercises)
  const durationMin = workout.finished_at
    ? Math.round((new Date(workout.finished_at).getTime() - new Date(workout.started_at).getTime()) / 60_000)
    : null

  return (
    <div className="stack">
      <div className="stack-sm">
        <p className="eyebrow">
          {longDate(workout.started_at)} · {timeOfDay(workout.started_at)}
        </p>
        <div className="tiles">
          <div className="tile">
            <div className="k">{durationMin !== null && durationMin > 0 ? 'Duration' : 'Exercises'}</div>
            <div className="v">
              {durationMin !== null && durationMin > 0 ? (
                <>
                  {durationMin}
                  <small>min</small>
                </>
              ) : (
                exercises.length
              )}
            </div>
          </div>
          <div className="tile">
            <div className="k">Sets</div>
            <div className="v">{workoutSetCount(workout)}</div>
          </div>
          <div className="tile">
            <div className="k">Volume</div>
            <div className="v">{formatKg(workoutVolume(workout))}</div>
          </div>
        </div>
      </div>

      {exercises.map((exercise) => {
        const sets = [...exercise.workout_sets].sort((a, b) => a.set_number - b.set_number)
        const best = topSet(sets)
        return (
          <section className="section" key={exercise.id}>
            <div className="section-label plain">{exercise.exercise_name}</div>
            <div className="group">
              {sets.map((set, index) => (
                <div className="row" key={set.id}>
                  <span className="set-no">{index + 1}</span>
                  <span className="grow num">{formatSet(Number(set.weight_kg), Number(set.reps))}</span>
                  {set === best && sets.length > 1 ? <span className="badge">Top set</span> : null}
                </div>
              ))}
            </div>
          </section>
        )
      })}

      <button type="button" className="btn btn-danger-tinted" onClick={onDelete}>
        Delete workout
      </button>
    </div>
  )
}
