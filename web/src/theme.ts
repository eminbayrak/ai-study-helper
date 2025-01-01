import { createTheme } from '@mui/material';

export const getTheme = (mode: 'light' | 'dark') => createTheme({
  palette: {
    mode,
    ...(mode === 'dark' ? {
      // Dark mode colors
      primary: {
        main: '#4CAF50', // Green for success
      },
      secondary: {
        main: '#FF4444', // Red for errors/skip
      },
      background: {
        default: '#0A1929',
        paper: '#132F4C',
      },
      text: {
        primary: '#fff',
        secondary: 'rgba(255, 255, 255, 0.7)',
      },
    } : {
      // Light mode colors
      primary: {
        main: '#4CAF50',
      },
      secondary: {
        main: '#FF4444',
      },
    }),
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          ...(mode === 'dark' && {
            backgroundColor: '#132F4C',
          }),
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: '50%',
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