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
        id: 'serika',
        name: 'Serika Dark',
        colors: {
            bg: '#323437',
            main: '#ffd700',
            sub: '#cccccc',
            card: '#2e2e2e',
            text: '#f8f8f8',
            error: '#ff4d4d',
            success: '#3fb950'
        }
    },
    {
        id: 'dracula',
        name: 'Dracula',
        colors: {
            bg: '#282a36',
            main: '#ff79c6',
            sub: '#b3b3d1',
            card: '#44475a',
            text: '#ffffff',
            error: '#ff5555',
            success: '#50fa7b'
        }
    },
    {
        id: 'monokai',
        name: 'Monokai',
        colors: {
            bg: '#272822',
            main: '#fd971f',
            sub: '#ccccaa',
            card: '#3e3d32',
            text: '#f8f8f2',
            error: '#f92672',
            success: '#a6e22e'
        }
    },
    {
        id: 'nord',
        name: 'Nord',
        colors: {
            bg: '#2e3440',
            main: '#81a1c1',
            sub: '#a3a9b5',
            card: '#3b4252',
            text: '#e5e9f0',
            error: '#bf616a',
            success: '#a3be8c'
        }
    },
    {
        id: 'pastel',
        name: 'Pastel',
        colors: {
            bg: '#F4B4B0',
            main: '#FFDD67',
            sub: '#e0c3c3',
            card: '#D49B97',
            text: '#2C2C2C',
            error: '#E15A54',
            success: '#89C7BA'
        }
    },
    {
        id: 'sepia',
        name: 'Sepia',
        colors: {
            bg: '#f4ecd8',
            main: '#8b4513',
            sub: '#a0897d',
            card: '#e8dcc8',
            text: '#2f1e14',
            error: '#b22222',
            success: '#2e5014'
        }
    },
    {
        id: 'lavender',
        name: 'Lavender',
        colors: {
            bg: '#f5f5ff',
            main: '#8a7ca8',
            sub: '#b0a6c2',
            card: '#ddd7eb',
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
            main: '#3ba992',
            sub: '#8ebfb5',
            card: '#d9f2ea',
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
            sub: '#96a3a6',
            card: '#073642',
            text: '#eee8d5',
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
            sub: '#7f8697',
            card: '#252b37',
            text: '#ffffff',
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
            card: '#ffeef2',
            text: '#4f4f4f',
            error: '#ff4477',
            success: '#66cdaa'
        }
    },
    {
        id: 'ruby',
        name: 'Ruby',
        colors: {
            bg: '#044f54',
            main: '#ffcc00',
            sub: '#5a9da0',
            card: '#055c62',
            text: '#ffffff',
            error: '#ff5555',
            success: '#00cc99'
        }
    }
];

export function CustomThemeProvider({ children }: { children: React.ReactNode; }) {
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
