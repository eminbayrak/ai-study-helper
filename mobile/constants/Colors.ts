/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#F54B64';
const tintColorDark = '#FF6B81';

const Colors = {
  light: {
    primary: '#F54B64',
    secondary: '#22C55E',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#1E293B',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    shadow: '#000000',
    success: '#10B981',
    error: '#EF4444',
    tint: '#F54B64',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#F54B64',
    cardBackground: '#FFFFFF',
    inputBackground: '#FFFFFF',
  },
  dark: {
    primary: '#FF6B81',
    secondary: '#34D399',
    background: '#0F172A',
    surface: '#1E293B',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: '#334155',
    shadow: '#000000',
    success: '#34D399',
    error: '#F87171',
    tint: '#FF6B81',
    tabIconDefault: '#64748B',
    tabIconSelected: '#FF6B81',
    cardBackground: '#1E293B',
    inputBackground: '#1E293B',
  },
} as const;

export default Colors;
