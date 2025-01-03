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
      sub: '#4a4a4a',
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
      main: '#2E7D32',
      sub: '#757575',
      text: '#2c2c2c',
      error: '#d32f2f',
      success: '#2E7D32'
    }
  },
  {
    id: 'sepia',
    name: 'Sepia',
    colors: {
      bg: '#f4ecd8',
      main: '#8b4513',
      sub: '#6b5744',
      text: '#433022',
      error: '#b22222',
      success: '#2e5014'
    }
  },
  {
    id: 'lavender',
    name: 'Lavender',
    colors: {
      bg: '#f5f5ff',
      main: '#7b6ca6',
      sub: '#6c6c99',
      text: '#2d2d4d',
      error: '#d63939',
      success: '#3d691d'
    }
  },
  {
    id: 'mint',
    name: 'Mint',
    colors: {
      bg: '#f5fffa',
      main: '#2b8c6f',
      sub: '#5c8c83',
      text: '#1a3b3b',
      error: '#d63939',
      success: '#2b754c'
    }
  },
  {
    id: 'solarized',
    name: 'Solarized',
    colors: {
      bg: '#002b36',
      main: '#cb4b16',
      sub: '#586e75',
      text: '#93a1a1',
      error: '#dc322f',
      success: '#859900'
    }
  },
  {
    id: 'poimandres',
    name: 'Poimandres',
    colors: {
      bg: '#1b1e28',
      main: '#a6da95',
      sub: '#4f5873',
      text: '#e4f0fb',
      error: '#d0679d',
      success: '#5de4c7'
    }
  },
  {
    id: 'hellokitty',
    name: 'Hello Kitty',
    colors: {
      bg: '#ffffff',
      main: '#ff66aa',
      sub: '#ffb7d5',
      text: '#4f4f4f',
      error: '#ff4477',
      success: '#66cdaa'
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