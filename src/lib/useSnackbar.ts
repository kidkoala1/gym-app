import { useCallback, useState } from 'react'

export type SnackbarState = {
  open: boolean
  severity: 'success' | 'error' | 'info'
  message: string
}

export function useSnackbar() {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    severity: 'info',
    message: '',
  })

  const showError = useCallback((message: string) => {
    setSnackbar({ open: true, severity: 'error', message })
  }, [])

  const showSuccess = useCallback((message: string) => {
    setSnackbar({ open: true, severity: 'success', message })
  }, [])

  const closeSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }))
  }, [])

  return { snackbar, showError, showSuccess, closeSnackbar }
}
