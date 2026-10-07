import { useEffect, useRef, useState, type ReactNode } from 'react'

const OPEN_OFFSET = -88
const MAX_OFFSET = -120

type SwipeRowProps = {
  children: ReactNode
  onDelete: () => void
  /** Class for the sliding part, e.g. the set row's grid. */
  className?: string
  deleteLabel?: string
}

/** A row that slides left to reveal a Delete button, like iOS lists. */
export function SwipeRow({ children, onDelete, className = '', deleteLabel = 'Delete' }: SwipeRowProps) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; y: number; base: number; active: boolean } | null>(null)
  const swallowClick = useRef(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const isOpen = offset === OPEN_OFFSET && !dragging

  // An open row closes when anything else is touched.
  useEffect(() => {
    if (!isOpen) return
    const close = (event: PointerEvent) => {
      if (!rowRef.current?.contains(event.target as Node)) setOffset(0)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [isOpen])

  function endDrag() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.active) {
      // A tap on an open row closes it instead of acting on what is underneath.
      if (d.base !== 0) {
        swallowClick.current = true
        setOffset(0)
      }
      return
    }
    swallowClick.current = true
    setDragging(false)
    setOffset((current) => (current < OPEN_OFFSET / 2 ? OPEN_OFFSET : 0))
  }

  return (
    <div className="swipe" ref={rowRef}>
      <button type="button" className="swipe-del" onClick={onDelete} tabIndex={isOpen ? 0 : -1} aria-hidden={!isOpen}>
        {deleteLabel}
      </button>
      <div
        className={`swipe-content ${className}${dragging ? ' dragging' : ''}`}
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        onPointerDown={(e) => {
          swallowClick.current = false
          drag.current = { x: e.clientX, y: e.clientY, base: offset, active: false }
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const dx = e.clientX - d.x
          const dy = e.clientY - d.y
          if (!d.active) {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
              d.active = true
              setDragging(true)
            } else if (Math.abs(dy) > 10) {
              drag.current = null
              return
            } else {
              return
            }
          }
          setOffset(Math.min(0, Math.max(MAX_OFFSET, d.base + dx)))
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (!swallowClick.current) return
          swallowClick.current = false
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        {children}
      </div>
    </div>
  )
}
