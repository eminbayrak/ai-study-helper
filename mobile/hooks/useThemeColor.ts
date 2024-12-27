/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useColorScheme } from 'react-native';
import Colors from '../constants/Colors';

type ColorScheme = 'light' | 'dark';

export function useThemeColor() {
  const scheme = useColorScheme() as ColorScheme;
  const colorScheme = scheme ?? 'light';
  const colors = Colors[colorScheme];
  
  return { colors };
}
