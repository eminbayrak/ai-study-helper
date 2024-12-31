import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Platform, Pressable } from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import Voice from '@react-native-voice/voice';
import Reanimated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useThemeColor } from '../../hooks/useThemeColor';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

// Types
type LanguageKey = 'en' | 'es' | 'fr';
type IconName = 'circle' | 'square' | 'change-history';

// Game configuration
const SHAPES = {
  CIRCLE: { name: 'circle', icon: 'circle' as IconName },
  SQUARE: { name: 'square', icon: 'square' as IconName },
  TRIANGLE: { name: 'change-history', icon: 'change-history' as IconName },
};

const WORDS = {
  en: ['hello', 'world', 'game', 'play', 'learn'],
  es: ['hola', 'mundo', 'juego', 'jugar', 'aprender'],
  fr: ['bonjour', 'monde', 'jeu', 'jouer', 'apprendre'],
};

type Shape = {
  type: { name: string; icon: IconName };
  word: string;
  id: number;
  position: Reanimated.SharedValue<number>;
  isStuck: boolean;
  holePosition?: number;
};

// Add hole configuration
const HOLES = [
  { type: 'circle', x: 0 },
  { type: 'square', x: 1 },
  { type: 'triangle', x: 2 },
];

function useShapePositions() {
  const positions = {
    first: useSharedValue(0),
    second: useSharedValue(0),
  };

  const createShape = useCallback((currentLanguage: LanguageKey, position: Reanimated.SharedValue<number>) => {
    const shapeTypes = Object.values(SHAPES);
    const randomShape = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
    const randomWord = WORDS[currentLanguage][Math.floor(Math.random() * WORDS[currentLanguage].length)];
    const holePosition = HOLES.findIndex(hole => hole.type === randomShape.name);

    return {
      type: randomShape,
      word: randomWord,
      id: Date.now(),
      position,
      isStuck: false,
      holePosition,
    };
  }, []);

  return { positions, createShape };
}

// Shape Component
const Shape = ({ shape, style }: { shape: Shape; style: any }) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shape.position.value },
      { translateY: shape.position.value * 0.5 }
    ],
    top: -50,
    right: 0,
  }));

  return (
    <Reanimated.View style={[style, animatedStyle]}>
      <MaterialIcons name={shape.type.icon} size={30} color="#000" />
      <ThemedText>{shape.word}</ThemedText>
    </Reanimated.View>
  );
};

// Add after Shape component
const WallWithHoles = () => {
  const { colors } = useThemeColor();
  
  const wallStyles = StyleSheet.create({
    wall: {
      width: '100%',
      height: 150,
      backgroundColor: colors.primary,
      position: 'absolute',
      bottom: 50,
      opacity: 0.8,
      flexDirection: 'row',
      justifyContent: 'space-evenly',
    },
    hole: {
      width: 110,
      height: 130,
      backgroundColor: colors.background,
      borderRadius: 8,
      marginVertical: 10,
    },
    circleHole: {
      borderRadius: 55,
    },
    squareHole: {
      borderRadius: 8,
    },
    triangleHole: {
      borderRadius: 8,
      transform: [{ rotate: '180deg' }],
    },
  });
  
  return (
    <View style={wallStyles.wall}>
      {HOLES.map((hole, index) => (
        <View 
          key={index} 
          style={[
            wallStyles.hole,
            hole.type === 'circle' && wallStyles.circleHole,
            hole.type === 'square' && wallStyles.squareHole,
            hole.type === 'triangle' && wallStyles.triangleHole,
          ]} 
        />
      ))}
    </View>
  );
};

declare global {
  interface Window {
    webkitSpeechRecognition: new () => {
      continuous: boolean;
      interimResults: boolean;
      onresult: (event: { results: { transcript: string }[][] }) => void;
      start: () => void;
      stop: () => void;
    };
  }
}

// Add this for shape generation timing
const SHAPE_INTERVAL = 5000; // 5 seconds between shapes
const SHAPE_DURATION = 8000; // 8 seconds to cross screen

export default function LinguaSlideScreen() {
  const { colors } = useThemeColor();
  const [currentLanguage, setCurrentLanguage] = useState<LanguageKey>('en');
  const [score, setScore] = useState(0);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const webSpeechRef = useRef<any>(null);
  const { positions, createShape } = useShapePositions();
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);

  const startGame = () => {
    setIsGameStarted(true);
    
    // Create initial shape
    const firstShape = createShape(currentLanguage, positions.first);
    setShapes([firstShape]);
    
    // Start from right side, higher up
    firstShape.position.value = Dimensions.get('window').width;
    firstShape.position.value = withTiming(
      Dimensions.get('window').width * 0.3,
      { 
        duration: SHAPE_DURATION,
        easing: (x) => Math.pow(x, 1.5)
      }
    );

    const interval = setInterval(() => {
      const newShape = createShape(currentLanguage, positions.second);
      newShape.position.value = Dimensions.get('window').width;
      newShape.position.value = withTiming(
        Dimensions.get('window').width * 0.3,
        { 
          duration: SHAPE_DURATION,
          easing: (x) => Math.pow(x, 1.5)
        }
      );
      setShapes(prev => [...prev, newShape]);
    }, SHAPE_INTERVAL);

    return () => clearInterval(interval);
  };

  useEffect(() => {
    if (Platform.OS === 'web') {
      if ('webkitSpeechRecognition' in window) {
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          const last = event.results.length - 1;
          const text = event.results[last][0].transcript;
          console.log('Speech detected:', text); // Debug speech
          checkPronunciation(text);
        };
        webSpeechRef.current = recognition;
      }
    } else {
      Voice.onSpeechResults = (e: any) => {
        console.log('Speech detected:', e.value[0]); // Debug speech
        checkPronunciation(e.value[0]);
      };
    }

    return () => cleanup();
  }, []);

  const cleanup = () => {
    if (Platform.OS === 'web') {
      webSpeechRef.current?.stop();
    } else {
      Voice.stop();
      Voice.destroy();
    }
  };

  const handleWebSpeechResult = (event: any) => {
    const text = event.results[event.results.length - 1][0].transcript.toLowerCase();
    checkPronunciation(text);
  };

  const handleMobileSpeechResult = (e: any) => {
    const spokenWords = e.value || [];
    checkPronunciation(spokenWords[0]?.toLowerCase());
  };

  const checkPronunciation = (spokenText: string) => {
    if (!spokenText) return;
    
    console.log('Spoken:', spokenText); // Debug speech

    // Find the rightmost shape that matches the word
    const matchedShape = [...shapes]
      .reverse()
      .find((shape) => 
        spokenText.toLowerCase().includes(shape.word.toLowerCase())
      );

    if (matchedShape) {
      console.log('Match found:', matchedShape.word); // Debug match
      setScore((prev) => prev + 1);
      
      // Animate through hole
      matchedShape.position.value = withSequence(
        withSpring(Dimensions.get('window').width * 0.15), // Move to hole
        withDelay(500, withSpring(-150)) // Then disappear
      );

      // Remove shape after animation
      setTimeout(() => {
        setShapes((prev) => prev.filter((s) => s.id !== matchedShape.id));
      }, 1500);
    }
  };

  const releaseShape = (shape: Shape) => {
    shape.position.value = withSpring(Dimensions.get('window').height);
    setShapes((prev) => prev.filter((s) => s.id !== shape.id));
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGameStarted && timer < 60) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGameStarted, timer]);

  const toggleMicrophone = async () => {
    try {
      if (isRecording) {
        if (Platform.OS === 'web') {
          webSpeechRef.current?.stop();
        } else {
          await Voice.stop();
        }
      } else {
        if (Platform.OS === 'web') {
          webSpeechRef.current?.start();
        } else {
          await Voice.start(currentLanguage === 'en' ? 'en-US' : currentLanguage === 'es' ? 'es-ES' : 'fr-FR');
        }
      }
      setIsRecording(!isRecording);
    } catch (e) {
      console.error(e);
    }
  };

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    gameArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: 100,
    },
    wall: {
      width: '100%',
      height: 150,
      backgroundColor: colors.primary,
      position: 'absolute',
      bottom: 50,
      opacity: 0.8,
      flexDirection: 'row',
      justifyContent: 'space-evenly',
    },
    hole: {
      width: 110,
      height: 130,
      backgroundColor: colors.background,
      borderRadius: 8,
      marginVertical: 10,
    },
    rail: {
      width: '100%',
      height: 10,
      backgroundColor: colors.primary,
      position: 'absolute',
      bottom: 50,
    },
    micButton: {
      position: 'absolute',
      top: 100,
      left: 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: isRecording ? colors.secondary : colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    timer: {
      position: 'absolute',
      top: 100,
      right: 20,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    timerText: {
      color: colors.background,
      fontSize: 24,
      fontWeight: 'bold',
    },
    shape: {
      width: 100,
      height: 120,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'absolute',
      backgroundColor: colors.surface,
      borderRadius: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    score: {
      position: 'absolute',
      top: 20,
      right: 20,
      fontSize: 24,
      color: colors.primary,
    },
    startButton: {
    position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -75 }, { translateY: -25 }],
      backgroundColor: colors.primary,
      paddingHorizontal: 30,
      paddingVertical: 15,
      borderRadius: 25,
      elevation: 5,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    buttonText: {
      color: colors.background,
      fontSize: 20,
      fontWeight: 'bold',
    },
    circleHole: {
      borderRadius: 55,
    },
    squareHole: {
      borderRadius: 8,
    },
    triangleHole: {
      borderRadius: 8,
      transform: [{ rotate: '180deg' }],
  },
});

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.score}>Score: {score}</ThemedText>
      {!isGameStarted ? (
        <Pressable style={styles.startButton} onPress={startGame}>
          <ThemedText style={styles.buttonText}>Start Game</ThemedText>
        </Pressable>
      ) : (
        <View style={styles.gameArea}>
          <Pressable 
            style={styles.micButton}
            onPress={toggleMicrophone}
          >
            <FontAwesome 
              name={isRecording ? "microphone" : "microphone-slash"} 
              size={24} 
              color={colors.background} 
            />
          </Pressable>
          <View style={styles.timer}>
            <ThemedText style={styles.timerText}>
              {String(Math.floor(timer / 60)).padStart(2, '0')}:
              {String(timer % 60).padStart(2, '0')}
            </ThemedText>
          </View>
          <WallWithHoles />
          <View style={styles.rail} />
          {shapes.map((shape) => (
            <Shape key={shape.id} shape={shape} style={styles.shape} />
          ))}
        </View>
      )}
    </ThemedView>
  );
}
