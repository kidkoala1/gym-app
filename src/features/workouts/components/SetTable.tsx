import { Icon } from '../../../components/Icon'
import { SwipeRow } from '../../../components/SwipeRow'
import { isSetSaved, type DraftExercise } from '../workoutDraft'

type SetTableProps = {
  exercise: DraftExercise
  /** Shows a check on rows the database has (live workout). History edits save all at once instead. */
  showSaved: boolean
  onChange: (setKey: string, field: 'weight' | 'reps', value: string) => void
  onDelete: (setKey: string) => void
  onBlur?: () => void
}

/**
 * The set rows of one exercise. The last row is always empty and ready for the next set; swiping
 * a row left deletes it.
 */
export function SetTable({ exercise, showSaved, onChange, onDelete, onBlur }: SetTableProps) {
  return (
    <div className={showSaved ? 'sets' : 'sets no-state'}>
      <div className="sets-head" aria-hidden="true">
        <span>Set</span>
        <span>kg</span>
        <span>Reps</span>
        {showSaved ? <span /> : null}
      </div>
      {exercise.sets.map((set, index) => {
        const saved = isSetSaved(set)
        const label = `${exercise.name} set ${index + 1}`
        return (
          <SwipeRow
            key={set.key}
            className={showSaved && saved ? 'set-row done' : 'set-row'}
            onDelete={() => onDelete(set.key)}
          >
            <span className="set-no">{index + 1}</span>
            <input
              className="set-in"
              id={`set-${set.key}-weight`}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              placeholder="–"
              aria-label={`${label}, weight in kg`}
              value={set.weight}
              onChange={(e) => onChange(set.key, 'weight', e.target.value)}
              onBlur={onBlur}
            />
            <input
              className="set-in"
              id={`set-${set.key}-reps`}
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              placeholder="–"
              aria-label={`${label}, reps`}
              value={set.reps}
              onChange={(e) => onChange(set.key, 'reps', e.target.value)}
              onBlur={onBlur}
            />
            {showSaved ? (
              <span className="set-state" aria-label={saved ? 'Saved' : 'Not saved yet'}>
                {saved ? <Icon name="check" /> : null}
              </span>
            ) : null}
          </SwipeRow>
        )
      })}
    </div>
  )
}
