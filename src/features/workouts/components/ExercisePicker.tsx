import { useState } from 'react'
import { BottomSheet } from '../../../components/BottomSheet'
import { Icon } from '../../../components/Icon'

type ExercisePickerProps = {
  open: boolean
  title: string
  names: string[]
  onPick: (name: string) => void
  onClose: () => void
  /** Shown first while the search is empty, e.g. the exercises of the last workout with the same name. */
  suggested?: { label: string; names: string[] } | null
  /** Small text on the right of a row, e.g. last time's top set. */
  describe?: (name: string) => string | undefined
  /** Selection mode: marks the current choice and offers no "Add" row for new names. */
  current?: string
  allowNew?: boolean
}

/** A searchable list of exercises in a bottom sheet. */
export function ExercisePicker(props: ExercisePickerProps) {
  return (
    <BottomSheet
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      tall
      left={
        <button type="button" onClick={props.onClose}>
          Cancel
        </button>
      }
    >
      {/* The sheet unmounts its content once closed, so the search starts empty every time. */}
      <PickerContent {...props} />
    </BottomSheet>
  )
}

function PickerContent({ names, onPick, suggested, describe, current, allowNew = true }: ExercisePickerProps) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const row = (name: string) => {
    const detail = current !== undefined ? undefined : describe?.(name)
    return (
      <button key={name} type="button" className="row" onClick={() => onPick(name)}>
        <span className="grow">{name}</span>
        {current === name ? <Icon name="check" className="check-mark" /> : null}
        {detail ? <span className="value sm">{detail}</span> : null}
      </button>
    )
  }

  let content
  if (q) {
    const hits = names.filter((name) => name.toLowerCase().includes(q))
    const exact = names.some((name) => name.toLowerCase() === q)
    content = (
      <>
        {allowNew && !exact ? (
          <div className="group">
            <button type="button" className="row accent-row" onClick={() => onPick(query.trim())}>
              <Icon name="plus" />
              <span className="grow">Add “{query.trim()}”</span>
            </button>
          </div>
        ) : null}
        {hits.length > 0 ? (
          <div className="group">{hits.map(row)}</div>
        ) : !allowNew ? (
          <p className="footnote">No exercise matches “{query.trim()}”.</p>
        ) : null}
      </>
    )
  } else {
    content = (
      <>
        {suggested && suggested.names.length > 0 ? (
          <section className="section">
            <div className="section-label">{suggested.label}</div>
            <div className="group">{suggested.names.map(row)}</div>
          </section>
        ) : null}
        <section className="section">
          <div className="section-label">{allowNew ? 'All exercises' : 'Logged exercises'}</div>
          <div className="group">{names.map(row)}</div>
        </section>
      </>
    )
  }

  return (
    <div className="stack-sm">
      <div className="search">
        <Icon name="search" />
        <input
          className="field"
          type="search"
          placeholder="Search exercises"
          autoComplete="off"
          enterKeyHint="done"
          aria-label="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </div>
      {content}
    </div>
  )
}
