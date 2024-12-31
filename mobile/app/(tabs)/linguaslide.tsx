import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Platform, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Voice from '@react-native-voice/voice';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useThemeColor } from '../../hooks/useThemeColor';
import ENV from '../../env';

declare global {
  interface Window {
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
    };
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  onstart: () => void;
  onend: () => void;
  onerror: (event: { error: string }) => void;
  onresult: (event: { results: { transcript: string }[][] }) => void;
  start: () => void;
  stop: () => void;
}

// Update the types
type Difficulty = 'easy' | 'medium' | 'hard';

type WordStatus = {
  word: string;
  completed: boolean;
  unlocked: boolean;
  spokenWord?: string;
};

type WordSets = {
  [key in Difficulty]: string[];
};

export default function LinguaSlideScreen() {
  const { colors } = useThemeColor();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [wordList, setWordList] = useState<WordStatus[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const webSpeechRef = useRef<any>(null);

  // Fetch words from API
  const fetchWords = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${ENV.API_URL}/words/random`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch words');
      }

      const data: WordSets = await response.json();
      
      // Initialize word list with the fetched words
      const initialWords = data[difficulty].map((word, index) => ({
        word,
        completed: false,
        unlocked: index === 0
      }));
      
      setWordList(initialWords);
      setProgress(0);
    } catch (error) {
      console.error('Error fetching words:', error);
      Alert.alert(
        'Error',
        'Failed to load words. Please try again.',
        [{ text: 'OK', onPress: () => {} }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch words when difficulty changes
  useEffect(() => {
    fetchWords();
  }, [difficulty]);

  // Voice recognition setup
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
          checkPronunciation(text);
        };
        webSpeechRef.current = recognition;
      }
    } else {
      Voice.onSpeechStart = () => console.log('Speech recognition started (mobile)');
      Voice.onSpeechEnd = () => console.log('Speech recognition ended (mobile)');
      Voice.onSpeechError = (e) => console.error('Speech recognition error (mobile):', e);
      Voice.onSpeechResults = (e: any) => {
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
    if (!spokenText) return; // Guard against empty speech input
    
    const spokenLower = spokenText.toLowerCase().trim();
    console.log('Player spoke:', spokenLower);
    
    setWordList((prevWordList) => {
      const currentWordIndex = prevWordList.findIndex(w => w.unlocked && !w.completed);

      if (currentWordIndex === -1) {
        console.log('All words completed - fetching new words');
        fetchWords();
        return prevWordList;
      }

      const currentWord = prevWordList[currentWordIndex];
      const targetLower = currentWord.word.toLowerCase().trim();

      // Always update the current word with the spoken attempt
      const updatedWordList = prevWordList.map((word, index) => {
        if (index === currentWordIndex) {
          return {
            ...word,
            spokenWord: spokenLower,
            completed: spokenLower === targetLower,
          };
        }
        // Only unlock next word if current word is correctly pronounced
        if (index === currentWordIndex + 1 && spokenLower === targetLower) {
          return { ...word, unlocked: true };
        }
        return word;
      });

      // Update progress only on correct pronunciation
      if (spokenLower === targetLower) {
        setProgress((currentWordIndex + 1) * 10);
      }

      return updatedWordList;
    });
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Pronunciation Game</ThemedText>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={styles.loadingText}>Loading words...</ThemedText>
        </View>
      ) : (
        <>
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
                <View style={styles.wordContent}>
                  <ThemedText style={styles.word}>{item.word}</ThemedText>
                  {item.spokenWord && item.unlocked && (
                    <View style={styles.spokenWordContainer}>
                      <ThemedText style={styles.arrow}>→</ThemedText>
                      <ThemedText style={[
                        styles.spokenWord,
                        { 
                          color: item.spokenWord === item.word.toLowerCase() 
                            ? 'green' 
                            : '#FF4444'
                        }
                      ]}>
                        {item.spokenWord}
                      </ThemedText>
                    </View>
                  )}
                </View>
                {item.completed && (
                  <MaterialIcons 
                    name="check-circle" 
                    size={24} 
                    color="green" 
                    style={styles.checkIcon}
                  />
                )}
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
              onPress={fetchWords}
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
        </>
      )}
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
  wordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  wordContent: {
    flex: 1,
  },
  word: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
  },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginVertical: 20 },
  button: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  difficultyControls: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 10 },
  difficultyButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  difficultyText: { fontSize: 14, fontWeight: '500' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  spokenWordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    marginRight: 8,
    fontSize: 14,
    color: '#666',
  },
  spokenWord: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  checkIcon: {
    marginLeft: 12,
  },
  lockedCard: {
    opacity: 0.5,
  },
});
