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
            main: '#e2b714',
            sub: '#646669',
            card: '#2c2e31',
            text: '#d1d0c5',
            error: '#ca4754',
            success: '#4CAF50'
        }
    },
    {
        id: 'dracula',
        name: 'Dracula',
        colors: {
            bg: '#282a36',
            main: '#bd93f9',
            sub: '#6272a4',
            card: '#44475a',
            text: '#f8f8f2',
            error: '#ff5555',
            success: '#50fa7b'
        }
    },
    {
        id: 'monokai',
        name: 'Monokai',
        colors: {
            bg: '#272822',
            main: '#f92672',
            sub: '#75715e',
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
            main: '#88c0d0',
            sub: '#4c566a',
            card: '#3b4252',
            text: '#d8dee9',
            error: '#bf616a',
            success: '#a3be8c'
        }
    },
    {
        id: 'pastel',
        name: 'Pastel',
        colors: {
            bg: '#F4B4B0',
            main: '#FDF587',
            sub: '#B88B88',
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
            sub: '#6b5744',
            card: '#e8dcc8',
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
            card: '#e8dcc8',
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
            card: '#e8dcc8',
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
            card: '#073642',
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
            card: '#252b37',
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
            card: '#fff0f5',
            text: '#4f4f4f',
            error: '#ff4477',
            success: '#66cdaa'
        }
    },
    {
        id: 'ruby',
        name: 'Ruby',
        colors: {
            bg: '#07737A',
            main: '#F3E03A',
            sub: '#27858B',
            card: '#055C62',
            text: '#F3E03A',
            error: '#FF5555',
            success: '#00CC99'
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