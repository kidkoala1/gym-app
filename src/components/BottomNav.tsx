import { Icon, type IconName } from './Icon'

export type TabView = 'workout' | 'progress' | 'history' | 'settings'

const TABS: Array<{ value: TabView; label: string; icon: IconName }> = [
  { value: 'workout', label: 'Workout', icon: 'dumbbell' },
  { value: 'progress', label: 'Progress', icon: 'chart' },
  { value: 'history', label: 'History', icon: 'clock' },
  { value: 'settings', label: 'Settings', icon: 'sliders' },
]

type BottomNavProps = {
  value: TabView
  onChange: (value: TabView) => void
  /** Shows a dot on the Workout tab while a workout is running and another tab is open. */
  workoutInProgress: boolean
}

export function BottomNav({ value, onChange, workoutInProgress }: BottomNavProps) {
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className="tab"
            aria-current={value === tab.value ? 'page' : undefined}
            onClick={() => onChange(tab.value)}
          >
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
            {tab.value === 'workout' && workoutInProgress && value !== 'workout' ? (
              <i className="dot" aria-label="Workout in progress" />
            ) : null}
          </button>
        ))}
      </div>
    </nav>
  )
}
