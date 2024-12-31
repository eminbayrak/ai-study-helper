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
  skipped?: boolean;
};

type WordSets = {
  [key in Difficulty]: string[];
};

// Add these new types
type GameState = 'ready' | 'playing' | 'finished';
type GameResult = {
  score: number;
  wordsCompleted: number;
  timeSpent: number;
  accuracy: number;
};

export default function LinguaSlideScreen() {
  const { colors } = useThemeColor();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [wordList, setWordList] = useState<WordStatus[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const webSpeechRef = useRef<any>(null);
  const [gameState, setGameState] = useState<GameState>('ready');
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isStarting, setIsStarting] = useState(false);

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
    // Only setup speech recognition if game is playing
    if (gameState !== 'playing') {
      // Cleanup any existing speech recognition when game is not playing
      if (Platform.OS === 'web') {
        if (webSpeechRef.current) {
          webSpeechRef.current.stop();
          webSpeechRef.current = null;
        }
      } else {
        Voice.stop();
        Voice.removeAllListeners();
      }
      setIsListening(false);
      return;
    }

    if (Platform.OS === 'web') {
      if ('webkitSpeechRecognition' in window) {
        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onstart = () => {
          console.log('Speech recognition started');
          setIsListening(true);
        };
        recognition.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
          // Only restart if game is still playing
          if (gameState === 'playing') {
            recognition.start();
          }
        };
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
        };
        recognition.onresult = (event) => {
          const last = event.results.length - 1;
          const text = event.results[last][0].transcript;
          console.log('Speech detected:', text);
          checkPronunciation(text);
        };
        webSpeechRef.current = recognition;
        recognition.start();
      }
    } else {
      Voice.onSpeechStart = () => {
        console.log('Speech recognition started (mobile)');
        setIsListening(true);
      };
      Voice.onSpeechEnd = () => {
        console.log('Speech recognition ended (mobile)');
        setIsListening(false);
        // Only restart if game is still playing
        if (gameState === 'playing') {
          Voice.start('en-US');
        }
      };
      Voice.onSpeechError = (e) => {
        console.error('Speech recognition error (mobile):', e);
      };
      Voice.onSpeechResults = (e: any) => {
        if (e.value && e.value[0]) {
          console.log('Speech detected (mobile):', e.value[0]);
          checkPronunciation(e.value[0]);
        }
      };
      Voice.start('en-US');
    }

    // Cleanup function
    return () => {
      if (Platform.OS === 'web') {
        if (webSpeechRef.current) {
          webSpeechRef.current.stop();
          webSpeechRef.current = null;
        }
      } else {
        Voice.stop();
        Voice.removeAllListeners();
      }
      setIsListening(false);
    };
  }, [gameState]); // Only depend on gameState

  const toggleListening = async () => {
    if (gameState !== 'playing') return; // Prevent toggling when game is not playing
    
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

  const calculateScore = (wordsCompleted: number, timeSpent: number, attempts: number) => {
    const speedBonus = Math.max(0, 30 - timeSpent) * 10; // Up to 300 points for speed
    const accuracyScore = (wordsCompleted / Math.max(attempts, 1)) * 500; // Prevent division by zero
    const completionScore = wordsCompleted * 50; // 50 points per word
    return Math.round(Math.max(0, speedBonus + accuracyScore + completionScore)); // Ensure non-negative
  };

  const startGame = async () => {
    setIsStarting(true);
    try {
      await fetchWords();
      setGameState('playing');
      setTimeLeft(30);
      setProgress(0);
      
      // Reset any existing speech recognition
      if (Platform.OS === 'web') {
        if (webSpeechRef.current) {
          webSpeechRef.current.stop();
          setTimeout(() => {
            webSpeechRef.current?.start();
            setIsListening(true);
          }, 100);
        }
      } else {
        try {
          await Voice.stop();
          setTimeout(async () => {
            await Voice.start('en-US');
            setIsListening(true);
          }, 100);
        } catch (e) {
          console.error('Error starting voice recognition:', e);
        }
      }
      
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } finally {
      setIsStarting(false);
    }
  };

  const endGame = () => {
    setGameState('finished');

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Force cleanup of speech recognition
    if (Platform.OS === 'web') {
      if (webSpeechRef.current) {
        webSpeechRef.current.onend = null;
        webSpeechRef.current.stop();
        webSpeechRef.current = null;
      }
    } else {
      Voice.destroy().then(Voice.removeAllListeners);
    }
    setIsListening(false);
    
    // Calculate game statistics
    const completedWords = wordList.filter(w => w.completed && !w.skipped).length;
    const skippedWords = wordList.filter(w => w.skipped).length;
    const totalAttempts = wordList.reduce((acc, word) => acc + (word.spokenWord ? 1 : 0), 0);
    const timeSpent = Math.max(1, 30 - timeLeft);
    
    // Calculate accuracy based on completed words vs attempts
    const accuracy = totalAttempts > 0 
      ? (completedWords / totalAttempts) * 100 
      : 0;

    // Calculate score components with adjusted weights and skip penalty
    const speedBonus = Math.max(0, 30 - timeSpent) * 10; // Up to 300 points for speed
    const accuracyBonus = Math.round((accuracy / 100) * 300); // Up to 300 points for accuracy
    const completionBonus = completedWords * 40; // 40 points per word, up to 400 points
    const skipPenalty = skippedWords * 20; // -20 points per skipped word

    const totalScore = Math.max(0, speedBonus + accuracyBonus + completionBonus - skipPenalty);

    const result = {
      score: totalScore,
      wordsCompleted: completedWords,
      timeSpent: timeSpent,
      accuracy: accuracy
    };

    console.log('Game Result:', {
      ...result,
      details: {
        completedWords,
        totalAttempts,
        speedBonus,
        accuracyBonus,
        completionBonus,
        wordStatuses: wordList.map(w => ({
          word: w.word,
          completed: w.completed,
          spokenWord: w.spokenWord,
          unlocked: w.unlocked
        }))
      }
    });

    setGameResult(result);
  };

  // Add this helper function for word comparison
  const isSimilarPronunciation = (spoken: string, target: string) => {
    // Common speech recognition substitutions
    const substitutions: { [key: string]: string[] } = {
      'tree': ['3', 'three'],
      'sun': ['son', 'sung'],
      'four': ['for', '4'],
      'two': ['to', 'too', '2'],
      'ate': ['eight', '8'],
      'see': ['sea', 'c'],
      'ball': ['bawl'],
      'one': ['won', '1'],
      'five': ['5'],
      'six': ['sicks', '6'],
      'seven': ['7'],
      'nine': ['9'],
      'ten': ['10'],
      'zero': ['0'],
      'write': ['right', 'rite'],
      'there': ['their', 'they\'re'],
      'here': ['hear'],
      'wear': ['where', 'ware'],
      'bear': ['bare'],
      'pair': ['pear', 'pare'],
      'flour': ['flower'],
      'meet': ['meat'],
      'hole': ['whole'],
      'knight': ['night'],
      'knows': ['nose'],
      'weight': ['wait'],
      'buy': ['by', 'bye'],
      'sale': ['sail'],
      'cent': ['sent', 'scent'],
      'weather': ['whether'],
      'principal': ['principle'],
      'capital': ['capitol'],
      'allowed': ['aloud'],
      'affect': ['effect'],
      'accept': ['except'],
      'already': ['all ready'],
      'desert': ['dessert'],
      'than': ['then'],
      'your': ['you\'re', 'yore'],
      'its': ['it\'s'],
      'whose': ['who\'s'],
      'peace': ['piece'],
      'brake': ['break'],
      'cite': ['site', 'sight'],
      'complement': ['compliment'],
      'council': ['counsel'],
      'die': ['dye'],
      'fair': ['fare'],
      'genes': ['jeans'],
      'grown': ['groan'],
      'higher': ['hire'],
      'idle': ['idol'],
      'in': ['inn'],
      'made': ['maid'],
      'mail': ['male'],
      'morning': ['mourning'],
      'passed': ['past'],
      'patients': ['patience'],
      'presence': ['presents'],
      'profit': ['prophet'],
      'rain': ['reign', 'rein'],
      'raise': ['rays', 'raze'],
      'role': ['roll'],
      'scene': ['seen'],
      'stationary': ['stationery'],
      'steal': ['steel'],
      'suite': ['sweet'],
      'their': ['there', 'they\'re'],
      'threw': ['through'],
      'throne': ['thrown'],
      'tide': ['tied'],
      'time': ['thyme'],
      'toe': ['tow'],
      'waist': ['waste'],
      'way': ['weigh', 'whey'],
      'weak': ['week'],
      'which': ['witch'],
      'would': ['wood'],
      'you\'re': ['your'],
      // Add more common substitutions as needed
    };

    // Direct match
    if (spoken === target) return true;
    
    // Check substitutions
    if (substitutions[target] && substitutions[target].includes(spoken)) {
      return true;
    }

    return false;
  };

  // Update the checkPronunciation function
  const checkPronunciation = (spokenText: string) => {
    if (!spokenText || gameState !== 'playing') return;
    
    const spokenLower = spokenText.toLowerCase().trim();
    console.log('Player spoke:', spokenLower);
    
    setWordList((prevWordList) => {
      const currentWordIndex = prevWordList.findIndex(w => w.unlocked && !w.completed);
      if (currentWordIndex === -1) return prevWordList;

      const currentWord = prevWordList[currentWordIndex];
      const targetLower = currentWord.word.toLowerCase().trim();
      
      const isCorrect = isSimilarPronunciation(spokenLower, targetLower);

      console.log('Comparing:', {
        spoken: spokenLower,
        target: targetLower,
        isMatch: isCorrect,
        currentIndex: currentWordIndex,
        currentCompleted: currentWord.completed
      });

      const updatedWordList = prevWordList.map((word, index) => {
        if (index === currentWordIndex) {
          return {
            ...word,
            spokenWord: spokenLower,
            completed: isCorrect
          };
        }
        if (index === currentWordIndex + 1 && isCorrect) {
          return { ...word, unlocked: true };
        }
        return word;
      });

      if (isCorrect) {
        console.log('Word completed:', currentWord.word);
        setProgress((currentWordIndex + 1) * 10);
        
        const allCompleted = updatedWordList.every(w => w.completed);
        if (allCompleted) {
          console.log('All words completed! Ending game...');
          setTimeout(() => endGame(), 500);
        }
      }

      return updatedWordList;
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const ScoreBoard = ({ result }: { result: GameResult }) => {
    const { colors } = useThemeColor();
    
    return (
      <View style={[styles.scoreBoard, { backgroundColor: colors.surface }]}>
        <ThemedText style={styles.scoreBoardTitle}>Game Over!</ThemedText>
        <View style={styles.scoreRow}>
          <ThemedText style={styles.scoreLabel}>Final Score:</ThemedText>
          <ThemedText style={styles.scoreValue}>{Math.round(result.score) || 0}</ThemedText>
        </View>
        <View style={styles.scoreRow}>
          <ThemedText style={styles.scoreLabel}>Words Completed:</ThemedText>
          <ThemedText style={styles.scoreValue}>{result.wordsCompleted}/10</ThemedText>
        </View>
        <View style={styles.scoreRow}>
          <ThemedText style={styles.scoreLabel}>Time Spent:</ThemedText>
          <ThemedText style={styles.scoreValue}>{result.timeSpent}s</ThemedText>
        </View>
        <View style={styles.scoreRow}>
          <ThemedText style={styles.scoreLabel}>Accuracy:</ThemedText>
          <ThemedText style={styles.scoreValue}>{Math.round(result.accuracy || 0)}%</ThemedText>
        </View>
        <Pressable
          style={[styles.playAgainButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            setGameState('ready');
            setGameResult(null);
          }}
        >
          <ThemedText style={styles.playAgainText}>Play Again</ThemedText>
        </Pressable>
      </View>
    );
  };

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
    difficultyControls: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
      marginVertical: 40,
    },
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
    scoreBoard: {
      backgroundColor: colors.surface,
      padding: 20,
      borderRadius: 12,
      alignItems: 'center',
      margin: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    scoreBoardTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
    },
    scoreRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 12,
    },
    scoreLabel: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    scoreValue: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    playAgainButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 20,
    },
    playAgainText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    timer: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 8,
    },
    startButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 8,
      alignSelf: 'center',
      marginTop: 20,
    },
    startButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
    },
    startScreen: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 100,
    },
    startingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <ThemedView style={styles.container}>
      {gameState === 'ready' ? (
        // Initial screen with difficulty selection and start button
        <View style={styles.startScreen}>
          <ThemedText style={styles.title}>Pronunciation Game</ThemedText>
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
          <Pressable
            style={[
              styles.startButton,
              { backgroundColor: colors.primary },
              isStarting && { opacity: 0.7 }
            ]}
            onPress={startGame}
            disabled={isStarting}
          >
            {isStarting ? (
              <View style={styles.startingContainer}>
                <ActivityIndicator color="white" />
                <ThemedText style={[styles.startButtonText, { marginLeft: 10 }]}>
                  Starting...
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.startButtonText}>Start Game</ThemedText>
            )}
          </Pressable>
        </View>
      ) : gameState === 'playing' ? (
        // Game screen
        <>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Pronunciation Game</ThemedText>
            <ThemedText style={styles.timer}>Time: {timeLeft}s</ThemedText>
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
                    <ThemedText style={styles.word}>{item.word}</ThemedText>
                    {item.completed && (
                      <MaterialIcons 
                        name={item.skipped ? "close" : "check-circle"} 
                        size={24} 
                        color={item.skipped ? "#FF4444" : "green"} 
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
                  onPress={() => {
                    // Skip current word
                    setWordList((prevWordList) => {
                      const currentWordIndex = prevWordList.findIndex(w => w.unlocked && !w.completed);
                      if (currentWordIndex === -1) return prevWordList;

                      return prevWordList.map((word, index) => {
                        if (index === currentWordIndex) {
                          return { ...word, completed: true, skipped: true };
                        }
                        if (index === currentWordIndex + 1) {
                          return { ...word, unlocked: true };
                        }
                        return word;
                      });
                    });
                    setProgress((prev) => Math.min(100, prev + 10));
                  }}
                >
                  <MaterialIcons name="skip-next" size={24} color="white" />
                </Pressable>

                <Pressable
                  style={[styles.button, { backgroundColor: colors.primary }]}
                  onPress={fetchWords}
                >
                  <MaterialIcons name="refresh" size={24} color="white" />
                </Pressable>
              </View>
            </>
          )}
        </>
      ) : (
        // Game over screen
        <ScoreBoard result={gameResult!} />
      )}
    </ThemedView>
  );
}
