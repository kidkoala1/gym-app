import { Icon } from '../../../components/Icon'
import { formatClock } from '../../../lib/time'
import { useNow } from '../../../lib/useNow'

/**
 * "Since last set 1:23": counts up from the last completed set, as a reality check on rest time.
 * It never beeps and has no target.
 */
export function RestClock({ since, onDismiss }: { since: number; onDismiss: () => void }) {
  const now = useNow(1000)
  return (
    <div className="rest" role="timer" aria-label="Time since your last set">
      <span className="r-label">Since last set</span>
      <span className="r-time">{formatClock(now - since)}</span>
      <button type="button" className="r-btn" onClick={onDismiss} aria-label="Hide until the next set">
        <Icon name="x" />
      </button>
    </div>
  )
}
