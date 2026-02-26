import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import './index.css'
import App from './App.tsx'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// create a global query client instance
const queryClient = new QueryClient()
const theme = createTheme({
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: "'Segoe UI', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  palette: {
    mode: 'dark',
    primary: {
      main: '#9f7bff',
    },
    secondary: {
      main: '#7f68ff',
    },
    error: {
      main: '#ff557f',
    },
    background: {
      default: '#080a14',
      paper: 'rgba(20, 14, 42, 0.72)',
    },
    text: {
      primary: '#eef0ff',
      secondary: '#c4c9ff',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background:
            'radial-gradient(100% 140% at 8% -10%, rgba(111, 77, 204, 0.42), transparent 40%), radial-gradient(120% 120% at 100% 0%, rgba(59, 108, 171, 0.3), transparent 44%), linear-gradient(170deg, #070914, #0f1330 45%, #15183b 100%)',
          backgroundAttachment: 'fixed',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(183, 150, 255, 0.3)',
          background: 'linear-gradient(180deg, rgba(27, 20, 54, 0.72), rgba(16, 12, 36, 0.72))',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          boxShadow: '0 12px 36px rgba(10, 8, 24, 0.45)',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 99,
          background: 'linear-gradient(90deg, #a986ff, #7f68ff)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          color: '#c7cef9',
          '&.Mui-selected': {
            color: '#f2efff',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          color: '#faf9ff',
          borderRadius: 10,
          boxShadow: 'none',
        },
        contained: {
          border: '1px solid rgba(174, 142, 255, 0.35)',
          background: 'linear-gradient(180deg, rgba(103, 73, 188, 0.95), rgba(83, 57, 156, 0.92))',
        },
        outlined: {
          borderColor: 'rgba(173, 142, 255, 0.55)',
          color: '#e7dcff',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          color: '#f5f6ff',
          backgroundColor: 'rgba(15, 11, 34, 0.75)',
          borderRadius: 10,
          '& fieldset': {
            borderColor: 'rgba(173, 142, 255, 0.38)',
          },
          '&:hover fieldset': {
            borderColor: 'rgba(188, 149, 255, 0.7)',
          },
          '&.Mui-focused fieldset': {
            borderColor: 'rgba(188, 149, 255, 0.95)',
          },
        },
        input: {
          '::placeholder': {
            color: '#9ea4d9',
            opacity: 1,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#d8dcff',
          '&.Mui-focused': {
            color: '#e6ddff',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: '1px solid rgba(179, 149, 255, 0.4)',
          borderRadius: 14,
          background: 'linear-gradient(180deg, rgba(29, 21, 58, 0.96), rgba(20, 15, 43, 0.96))',
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          border: '1px solid rgba(183, 150, 255, 0.25)',
          background: 'rgba(19, 14, 40, 0.97)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        },
        option: {
          '&[aria-selected="true"]': {
            backgroundColor: 'rgba(124, 90, 211, 0.35)',
          },
          '&.Mui-focused': {
            backgroundColor: 'rgba(124, 90, 211, 0.25)',
          },
        },
      },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
