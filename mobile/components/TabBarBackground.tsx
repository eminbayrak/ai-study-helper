import { View } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';

export function TabBarBackground() {
  const { colors } = useThemeColor();

  return (
    <View 
      style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    />
  );
} 