import { Icon } from '../../../components/Icon'
import type { WorkoutHistoryRow } from '../../../types/db'
import { formatKg } from '../format'
import { sortedExercises, workoutDisplayTitle, workoutSetCount, workoutVolume } from '../workoutStats'

/** A past workout in a list: date, title, counts and exercise names. */
export function WorkoutRow({ workout, onOpen }: { workout: WorkoutHistoryRow; onOpen: () => void }) {
  const date = new Date(workout.started_at)
  const exercises = sortedExercises(workout.workout_exercises)
  return (
    <button type="button" className="row h-row" onClick={onOpen}>
      <div className="date-block" aria-hidden="true">
        <span>{date.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
        <b>{date.getDate()}</b>
      </div>
      <div className="grow">
        <div className="h-title">{workoutDisplayTitle(workout)}</div>
        <div className="h-meta">
          {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} · {workoutSetCount(workout)} sets ·{' '}
          {formatKg(workoutVolume(workout))}
        </div>
        <div className="h-names">{exercises.map((exercise) => exercise.exercise_name).join(', ')}</div>
      </div>
      <Icon name="chevronRight" className="chev" />
    </button>
  )
}
