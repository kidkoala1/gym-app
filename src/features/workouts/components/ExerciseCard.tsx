import { useQuery } from '@tanstack/react-query'
import { Icon } from '../../../components/Icon'
import { exerciseInsightsQuery } from '../exerciseQueries'
import { formatSet, shortDate } from '../format'
import type { ExerciseInsightSet } from '../localTypes'
import { isSetSaved, type DraftExercise } from '../workoutDraft'
import { SetTable } from './SetTable'

type ExerciseCardProps = {
  userId: string
  workoutId: string
  exercise: DraftExercise
  onChangeSet: (setKey: string, field: 'weight' | 'reps', value: string) => void
  onDeleteSet: (setKey: string) => void
  onBlur: () => void
  onOpenMenu: () => void
}

function InsightStat({ label, set }: { label: string; set: ExerciseInsightSet | null | undefined }) {
  return (
    <div>
      <span className="k">{label}</span>
      <span className="v">{set ? formatSet(set.weightKg, set.reps) : '—'}</span>
      <span className="d">{set ? shortDate(set.performedAt) : 'No sets yet'}</span>
    </div>
  )
}

/** One exercise in the live workout: last time / best in 60 days, then its sets. */
export function ExerciseCard({ userId, workoutId, exercise, onChangeSet, onDeleteSet, onBlur, onOpenMenu }: ExerciseCardProps) {
  const insightsQuery = useQuery(exerciseInsightsQuery(userId, exercise.name, workoutId))
  const insights = insightsQuery.data
  const savedCount = exercise.sets.filter(isSetSaved).length

  return (
    <article className="ex" aria-label={exercise.name}>
      <div className="ex-head">
        <h3>{exercise.name}</h3>
        <span className="count">
          {savedCount} {savedCount === 1 ? 'set' : 'sets'}
        </span>
        <button type="button" className="icon-btn sm plain" onClick={onOpenMenu} aria-label={`Options for ${exercise.name}`}>
          <Icon name="more" />
        </button>
      </div>

      {insightsQuery.isLoading ? null : insights?.lastSession ? (
        <div className="ins">
          <InsightStat label="Last time" set={insights.lastSession} />
          <InsightStat label="Best · 60 days" set={insights.recentBest} />
        </div>
      ) : (
        <p className="hint">First time logging this exercise.</p>
      )}

      <SetTable exercise={exercise} showSaved onChange={onChangeSet} onDelete={onDeleteSet} onBlur={onBlur} />
    </article>
  )
}
