import type { ReactNode } from 'react'
import { SwipeableDrawer } from '@mui/material'

type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title?: string
  /** Header buttons, e.g. Cancel on the left and Save on the right. */
  left?: ReactNode
  right?: ReactNode
  /** Nearly full height, for lists and forms. */
  tall?: boolean
  children: ReactNode
}

/** An iOS-style sheet that slides up from the bottom and can be swiped down to close. */
export function BottomSheet({ open, onClose, title, left, right, tall = false, children }: BottomSheetProps) {
  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => {}}
      disableSwipeToOpen
      disableDiscovery
      slotProps={{ paper: { className: tall ? 'sheet tall' : 'sheet', role: 'dialog', 'aria-label': title } }}
    >
      <div className="grabber" />
      {title !== undefined || left || right ? (
        <div className="sheet-head">
          <div className="l">{left}</div>
          <div className="t">{title}</div>
          <div className="r">{right}</div>
        </div>
      ) : null}
      <div className="sheet-body">{children}</div>
    </SwipeableDrawer>
  )
}
