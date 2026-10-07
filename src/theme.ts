import { createTheme } from '@mui/material'
import { secondaryFor, textColorOn } from './lib/color'

export const SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif"

/**
 * The app theme: iOS-style dark surfaces with one accent colour. Most styling lives in App.css as
 * CSS classes; MUI only provides the behaviour of sheets, dialogs and toasts. The accent is exposed
 * to CSS as --accent, --on-accent (text on accent) and --accent-2 (the compare line).
 */
export function buildTheme(accent: string) {
  const onAccent = textColorOn(accent)

  return createTheme({
    shape: { borderRadius: 12 },
    typography: { fontFamily: SYSTEM_FONT },
    palette: {
      mode: 'dark',
      primary: { main: accent, contrastText: onAccent },
      error: { main: '#ff453a' },
      success: { main: '#30d158' },
      background: { default: '#000000', paper: '#1c1c1e' },
      text: { primary: '#ffffff', secondary: 'rgba(235, 235, 245, 0.62)' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            '--accent': accent,
            '--on-accent': onAccent,
            '--accent-2': secondaryFor(accent),
          },
          body: { backgroundColor: '#000000' },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
    },
  })
}
