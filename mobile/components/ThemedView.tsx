import { View } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';

export function ThemedView(props: View['props']) {
  const { colors } = useThemeColor();
  
  return (
    <View 
      {...props} 
      style={[
        { backgroundColor: colors.background },
        props.style
      ]} 
    />
  );
}
