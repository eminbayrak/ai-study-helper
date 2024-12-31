import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Voice from '@react-native-voice/voice';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useThemeColor } from '../../hooks/useThemeColor';

declare global {
  interface Window {
    webkitSpeechRecognition: new () => {
      continuous: boolean;
      interimResults: boolean;
      onstart: () => void;
      onend: () => void;
      onerror: (event: { error: string }) => void;
      onresult: (event: { results: { transcript: string }[][] }) => void;
      start: () => void;
      stop: () => void;
    };
  }
}

// Word sets with increasing difficulty
const WORD_SETS = {
  easy: ['cat', 'dog', 'fish', 'bird', 'duck', 'cow', 'pig', 'hen', 'rat', 'goat'],
  medium: ['elephant', 'giraffe', 'penguin', 'dolphin', 'octopus', 'turtle', 'rabbit', 'monkey', 'tiger', 'zebra'],
  hard: ['hippopotamus', 'rhinoceros', 'chimpanzee', 'kangaroo', 'crocodile', 'butterfly', 'dragonfly', 'pelican', 'flamingo', 'penguin']
};

type Difficulty = 'easy' | 'medium' | 'hard';

type WordStatus = {
  word: string;
  completed: boolean;
  unlocked: boolean;
};

export default function LinguaSlideScreen() {
  const { colors } = useThemeColor();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [wordList, setWordList] = useState<WordStatus[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const webSpeechRef = useRef<any>(null);

  useEffect(() => {
    const initializeWords = () => {
      const initialWords = WORD_SETS[difficulty].map((word, index) => ({
        word,
        completed: false,
        unlocked: index === 0 // Only the first word is unlocked initially
      }));
      setWordList(initialWords);
      setProgress(0);
    };

    initializeWords();
  }, [difficulty]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if ('webkitSpeechRecognition' in window) {
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onstart = () => console.log('Speech recognition started');
        recognition.onend = () => console.log('Speech recognition ended');
        recognition.onerror = (event) => console.error('Speech recognition error:', event.error);
        recognition.onresult = (event) => {
          const last = event.results.length - 1;
          const text = event.results[last][0].transcript;
          console.log('Speech detected (web):', text);
          checkPronunciation(text);
        };
        webSpeechRef.current = recognition;
      }
    } else {
      Voice.onSpeechStart = () => console.log('Speech recognition started (mobile)');
      Voice.onSpeechEnd = () => console.log('Speech recognition ended (mobile)');
      Voice.onSpeechError = (e) => console.error('Speech recognition error (mobile):', e);
      Voice.onSpeechResults = (e: any) => {
        console.log('Speech detected (mobile):', e.value[0]);
        checkPronunciation(e.value[0]);
      };
    }

    return () => {
      if (Platform.OS !== 'web') {
        Voice.destroy().then(Voice.removeAllListeners);
      }
    };
  }, []);

  const toggleListening = async () => {
    try {
      if (isListening) {
        setIsListening(false);
        if (Platform.OS === 'web') {
          webSpeechRef.current?.stop();
        } else {
          await Voice.stop();
        }
      } else {
        setIsListening(true);
        if (Platform.OS === 'web') {
          webSpeechRef.current?.start();
        } else {
          await Voice.start('en-US');
        }
      }
    } catch (e) {
      console.error('Microphone toggle error:', e);
    }
  };

  const checkPronunciation = (spokenText: string) => {
    setWordList((prevWordList) => {
      const currentWordIndex = prevWordList.findIndex(w => w.unlocked && !w.completed);

      if (currentWordIndex === -1) {
        console.log('All words completed - resetting game');
        resetGame();
        return prevWordList;
      }

      const currentWord = prevWordList[currentWordIndex];
      const spokenLower = spokenText.toLowerCase().trim();
      const targetLower = currentWord.word.toLowerCase().trim();

      if (spokenLower === targetLower) {
        console.log('Match found! Word pronounced correctly');

        const updatedWordList = prevWordList.map((word, index) => {
          if (index === currentWordIndex) {
            return { ...word, completed: true };
          }
          if (index === currentWordIndex + 1) {
            return { ...word, unlocked: true };
          }
          return word;
        });

        setProgress((currentWordIndex + 1) * 10);
        return updatedWordList;
      } else {
        console.log('No match found, try again');
        return prevWordList;
      }
    });
  };

  const resetGame = () => {
    const resetWords = WORD_SETS[difficulty].map((word, index) => ({
      word,
      completed: false,
      unlocked: index === 0
    }));
    setWordList(resetWords);
    setProgress(0);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Pronunciation Game</ThemedText>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
        </View>
      </View>

      <View style={styles.wordList}>
        {wordList.map((item, index) => (
          <View
            key={index}
            style={[
              styles.wordCard,
              !item.unlocked && styles.lockedCard,
              { backgroundColor: colors.surface }
            ]}
          >
            <ThemedText style={styles.word}>{item.word}</ThemedText>
            {item.completed && <MaterialIcons name="check-circle" size={24} color="green" />}
          </View>
        ))}
      </View>

      <View style={styles.controls}>
        <Pressable
          style={[styles.button, { backgroundColor: isListening ? colors.secondary : colors.primary }]}
          onPress={toggleListening}
        >
          <MaterialIcons name={isListening ? 'mic' : 'mic-none'} size={24} color="white" />
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={resetGame}
        >
          <MaterialIcons name="refresh" size={24} color="white" />
        </Pressable>
      </View>

      <View style={styles.difficultyControls}>
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
          <Pressable
            key={level}
            style={[
              styles.difficultyButton,
              { 
                backgroundColor: difficulty === level ? colors.primary : colors.surface,
                borderColor: colors.primary
              }
            ]}
            onPress={() => setDifficulty(level)}
          >
            <ThemedText style={[
              styles.difficultyText,
              difficulty === level && { color: 'white' }
            ]}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  progressBar: { height: 10, backgroundColor: '#E0E0E0', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  wordList: { flex: 1, gap: 10 },
  wordCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 8 },
  lockedCard: { opacity: 0.5 },
  word: { fontSize: 18, fontWeight: '500' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginVertical: 20 },
  button: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  difficultyControls: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  difficultyButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  difficultyText: { fontSize: 14, fontWeight: '500' }
});
