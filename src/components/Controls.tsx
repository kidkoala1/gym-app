import type { ReactNode } from 'react'
import { Icon } from './Icon'

type SegmentedControlProps<T extends string> = {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  small?: boolean
  label: string
}

/** iOS segmented control: a row of mutually exclusive options. */
export function SegmentedControl<T extends string>({ options, value, onChange, small, label }: SegmentedControlProps<T>) {
  return (
    <div className={small ? 'seg sm' : 'seg'} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

type SwitchProps = {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

/** iOS toggle switch (a styled checkbox). */
export function Switch({ id, checked, onChange, label }: SwitchProps) {
  return (
    <label className="switch">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  )
}

/** A tappable list row with a chevron, as in iOS Settings. */
export function NavRow({ children, value, onClick }: { children: ReactNode; value?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="row" onClick={onClick}>
      <span className="grow">{children}</span>
      {value !== undefined ? <span className="value">{value}</span> : null}
      <Icon name="chevronRight" className="chev" />
    </button>
  )
}
