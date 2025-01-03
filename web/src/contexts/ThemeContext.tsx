import React, { createContext, useContext, useState, useEffect } from 'react';
import { Theme } from '../config/themes';

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const themes = [
  {
    id: 'dark',
    name: 'Dark',
    colors: {
      bg: '#323437',
      main: '#e2b714',
      sub: '#646669',
      text: '#d1d0c5',
      error: '#ca4754',
      success: '#4CAF50'
    }
  },
  {
    id: 'light',
    name: 'Light',
    colors: {
      bg: '#ffffff',
      main: '#4CAF50',
      sub: '#9e9e9e',
      text: '#2c2c2c',
      error: '#f44336',
      success: '#4CAF50'
    }
  },
  {
    id: 'sepia',
    name: 'Sepia',
    colors: {
      bg: '#f4ecd8',
      main: '#a0522d',
      sub: '#8b7355',
      text: '#5c4033',
      error: '#cd5c5c',
      success: '#228b22'
    }
  },
  {
    id: 'lavender',
    name: 'Lavender',
    colors: {
      bg: '#f5f5ff',
      main: '#9d8ec7',
      sub: '#a5a5cc',
      text: '#4a4a6a',
      error: '#ff6b6b',
      success: '#7cb342'
    }
  },
  {
    id: 'mint',
    name: 'Mint',
    colors: {
      bg: '#f5fffa',
      main: '#66cdaa',
      sub: '#a3d9c9',
      text: '#2f4f4f',
      error: '#ff6b6b',
      success: '#3cb371'
    }
  },
  {
    id: 'solarized',
    name: 'Solarized',
    colors: {
      bg: '#002b36',
      main: '#b58900',
      sub: '#586e75',
      text: '#93a1a1',
      error: '#dc322f',
      success: '#859900'
    }
  }
];

export function CustomThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      const theme = themes.find(t => t.id === savedTheme);
      if (theme) setCurrentTheme(theme);
    }
  }, []);

  const setTheme = (themeId: string) => {
    const theme = themes.find(t => t.id === themeId);
    if (theme) {
      setCurrentTheme(theme);
      localStorage.setItem('theme', themeId);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a CustomThemeProvider');
  }
  return context;
} 