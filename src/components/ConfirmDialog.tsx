import type { ReactNode } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  type ButtonProps,
} from '@mui/material'

type ConfirmDialogProps = {
  open: boolean
  title: string
  children: ReactNode
  cancelLabel?: string
  confirmLabel: string
  /** Extra props for the confirm button (colour, disabled, custom styling). */
  confirmButtonProps?: ButtonProps
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  children,
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmButtonProps,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          border: '1px solid rgba(179, 149, 255, 0.4)',
          borderRadius: 2,
          background: 'linear-gradient(180deg, rgba(29, 21, 58, 0.96), rgba(20, 15, 43, 0.96))',
          color: '#eef0ff',
        },
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button variant="outlined" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="contained" onClick={onConfirm} {...confirmButtonProps}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
