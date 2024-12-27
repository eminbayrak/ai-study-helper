import { Platform, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

export function HapticTab(props: any) {
  const { style, onPress, ...otherProps } = props;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  return (
    <Pressable
      {...otherProps}
      onPress={handlePress}
      style={({ pressed }) => [
        {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    />
  );
}
