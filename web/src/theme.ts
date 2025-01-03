import { createTheme } from '@mui/material';
import '@fontsource/inter/300.css';  // Light
import '@fontsource/inter/400.css';  // Regular
import '@fontsource/inter/500.css';  // Medium
import '@fontsource/inter/600.css';  // Semi-bold
import '@fontsource/inter/700.css';  // Bold

export const getTheme = (mode: 'light' | 'dark') => createTheme({
  palette: {
    mode,
    ...(mode === 'dark' ? {
      primary: {
        main: '#FF6B81', // dark mode primary
      },
      secondary: {
        main: '#34D399', // dark mode secondary
      },
      background: {
        default: '#323437', // dark background
        paper: '#1E293B',  // dark surface
      },
      text: {
        primary: '#F8FAFC',
        secondary: '#94A3B8',
      },
      error: {
        main: '#F87171',
      },
      success: {
        main: '#34D399',
      },
    } : {
      primary: {
        main: '#F54B64', // light mode primary
      },
      secondary: {
        main: '#22C55E', // light mode secondary
      },
      background: {
        default: '#F8FAFC', // light background
        paper: '#FFFFFF',   // light surface
      },
      text: {
        primary: '#1E293B',
        secondary: '#64748B',
      },
      error: {
        main: '#EF4444',
      },
      success: {
        main: '#10B981',
      },
    }),
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 500,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
    button: {
      fontWeight: 500,
      textTransform: 'none', // Prevents all-caps text
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'dark' ? '#1E293B' : '#FFFFFF',
          borderColor: mode === 'dark' ? '#334155' : '#E2E8F0',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: mode === 'dark' ? '#94A3B8' : '#94A3B8',
          '&:hover': {
            color: mode === 'dark' ? '#FF6B81' : '#F54B64',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 5,
          height: 8,
        },
      },
    },
  },
}); 