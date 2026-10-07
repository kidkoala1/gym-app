import type { ReactNode } from 'react'
import { Dialog } from '@mui/material'

type ConfirmDialogProps = {
  open: boolean
  title: string
  children?: ReactNode
  cancelLabel?: string
  confirmLabel: string
  /** Shows the confirm button in red, for actions that delete something. */
  destructive?: boolean
  confirmDisabled?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** An iOS-style alert: a short question with Cancel and a confirm button side by side. */
export function ConfirmDialog({
  open,
  title,
  children,
  cancelLabel = 'Cancel',
  confirmLabel,
  destructive = false,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      slotProps={{ paper: { className: 'alert', 'aria-labelledby': 'confirm-title' } }}
    >
      <div className="a-body">
        <h2 id="confirm-title">{title}</h2>
        {children ? <div className="a-msg">{children}</div> : null}
      </div>
      <div className="a-actions">
        <button type="button" className="bold" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={destructive ? 'destructive' : undefined}
          onClick={onConfirm}
          disabled={confirmDisabled}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
