declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

import { useEffect, useState, useRef } from 'react';
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import {
  Mic,
  MicOff,
  SkipForward,
  RefreshCw,
  Volume2,
  X,
  Play,
  Star,
  Timer,
} from "lucide-react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../components/ui/toggle-group";
import { useTheme } from '../contexts/ThemeContext';
import { Toaster } from "../components/ui/toaster";
import { toast } from "../hooks/use-toast";

// Assets
import successSoundFile from '../assets/sounds/success.mp3';
import failureSoundFile from '../assets/sounds/failure.mp3';

const successSound = successSoundFile;
const failureSound = failureSoundFile;

// Types
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'ready' | 'playing' | 'finished';
type Timeout = ReturnType<typeof setTimeout>;

interface WordStatus {
  word: string;
  phonetic: string;
  completed: boolean;
  unlocked: boolean;
  spokenWord?: string;
  skipped?: boolean;
  attempts: number;
  order: number;
  hadIncorrectAttempt: boolean;
  currentAttemptIncorrect: boolean;
  inactivitySkip?: boolean;
}

interface GameResult {
  wordsCompleted: number;
  timeSpent: number;
  accuracy: number;
}

// Constants
const DIFFICULTY_TIME_LIMITS: Record<Difficulty, number> = {
  easy: 45,
  medium: 60,
  hard: 75,
};

import profanity from 'leo-profanity';
import wordData from '../data/words.json';
import substitutionsData from '../data/substitutions.json';

// Add these helper functions at the top of your file
const isMobileBrowser = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const isSpeechRecognitionSupported = () => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

function LinguaSlide() {
  const { currentTheme } = useTheme();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [isListening, setIsListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gameState, setGameState] = useState<GameState>('ready');
  const [wordList, setWordList] = useState<WordStatus[]>([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const timerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const [lastSpokenTimestamp, setLastSpokenTimestamp] = useState<number>(Date.now());
  const [showInactiveWarning, setShowInactiveWarning] = useState(false);
  const [hasSpokenOnce, setHasSpokenOnce] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());

  // Add gameStateRef to track current state in callbacks
  const gameStateRef = useRef<GameState>('ready');

  // Update setGameState to keep ref in sync
  const updateGameState = (newState: GameState) => {
    gameStateRef.current = newState;
    setGameState(newState);
  };

  // Add refs to track state
  const isInitializedRef = useRef(false);
  const wordListRef = useRef<WordStatus[]>([]);

  // Add these refs back near the top with other refs
  const successAudio = useRef(new Audio(successSound));
  const failureAudio = useRef(new Audio(failureSound));

  // Add a new ref to track recognition state
  const isRecognitionActiveRef = useRef(false);

  // Move showToast inside the component to access currentTheme
  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    toast({
      variant: type === 'error' ? 'destructive' : 'default',
      title: type.charAt(0).toUpperCase() + type.slice(1),
      description: message,
      duration: 3000,
      className: "border-none",
      style: {
        backgroundColor: currentTheme.colors.sub,
        color: currentTheme.colors.text,
      },
    });
  };

  // Update fetchWords to use refs
  const fetchWords = async () => {
    try {
      setIsLoading(true);
      setApiError(null);

      // Get all words for the current difficulty
      const allWords = wordData[difficulty];
      
      // Filter out previously used words
      const availableWords = allWords.filter(word => !usedWords.has(word));
      
      // If we're running low on unused words, reset the used words
      if (availableWords.length < 10) {
        setUsedWords(new Set());
        // Use all words again
        availableWords.push(...allWords);
      }

      // Randomly select 10 words
      const selectedWords = [];
      const usedIndexes = new Set();
      const newUsedWords = new Set(usedWords);
      
      while (selectedWords.length < 10 && usedIndexes.size < availableWords.length) {
        const randomIndex = Math.floor(Math.random() * availableWords.length);
        if (!usedIndexes.has(randomIndex)) {
          const word = availableWords[randomIndex];
          selectedWords.push(word);
          newUsedWords.add(word);
          usedIndexes.add(randomIndex);
        }
      }

      // Update used words
      setUsedWords(newUsedWords);

      const initialWords = selectedWords.map((word, index) => ({
        word,
        phonetic: word.toLowerCase()
          .replace(/([aeiou])/g, '$1·')
          .split('')
          .join('‧')
          .replace(/‧$/,''),
        completed: false,
        unlocked: index === 0,
        order: index,
        attempts: 0,
        hadIncorrectAttempt: false,
        currentAttemptIncorrect: false
      }));
      
      wordListRef.current = initialWords;
      setWordList(initialWords);
      setProgress(0);
      return true;
    } catch (error) {
      console.error('Error loading words:', error);
      setApiError('Unable to load words. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (gameState === 'playing') {
      fetchWords();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [gameState]);

  // Timer for countdown
  useEffect(() => {
    if (gameState === 'playing' && !isLoading) {
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Start new timer
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Clear timer when not playing
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState, isLoading]); // Add isLoading dependency

  const startGame = async () => {
    if (isMobileBrowser() || !isSpeechRecognitionSupported()) {
      setErrorToast('Speech recognition is not supported in this browser. Please use a desktop browser like Chrome.');
      return;
    }

    setIsStarting(true);
    setHasSpokenOnce(false);

    try {
      // Reset states
      isInitializedRef.current = false;
      wordListRef.current = [];
      setWordList([]);

      // Fetch words first
      const fetchSuccess = await fetchWords();

      // Only proceed if fetch was successful
      if (fetchSuccess) {
        setTimeLeft(DIFFICULTY_TIME_LIMITS[difficulty]);
        setProgress(0);
        updateGameState('playing');
        isInitializedRef.current = true;
        setLastSpokenTimestamp(Date.now());
        setShowInactiveWarning(false);

        // Initialize speech recognition
        if ('webkitSpeechRecognition' in window) {
          const recognition = new (window as any).webkitSpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          recognition.lang = 'en-US';

          // Reduce the processing delay
          const processDelay = 100;

          recognition.onstart = () => {
            setIsListening(true);
            console.log('Speech recognition started');
          };

          recognition.onend = () => {
            setIsListening(false);
            console.log('Speech recognition ended');
            if (gameStateRef.current === 'playing' && isInitializedRef.current) {
              try {
                recognition.start();
              } catch (error) {
                console.error('Error restarting recognition:', error);
                setTimeout(() => {
                  try {
                    recognition.start();
                  } catch (e) {
                    console.error('Failed to restart recognition:', e);
                  }
                }, 100);
              }
            }
          };

          recognition.onerror = (event: { error: string; }) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
            isRecognitionActiveRef.current = false;
          };

          let lastProcessedResult = '';
          let processingTimeout: Timeout | null = null;

          recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              if (result.isFinal) {
                const transcript = result[0].transcript;
                if (profanity.check(transcript)) {
                  failureAudio.current.currentTime = 0;
                  failureAudio.current.play();
                  continue;
                }

                if (gameStateRef.current === 'playing' && isInitializedRef.current) {
                  const spokenText = transcript.toLowerCase().trim();

                  // Prevent processing the same word multiple times
                  if (spokenText === lastProcessedResult) {
                    continue;
                  }

                  lastProcessedResult = spokenText;
                  console.log('Spoken word:', spokenText);

                  // Clear any existing timeout
                  if (processingTimeout) {
                    clearTimeout(processingTimeout);
                  }

                  // Process after a short delay
                  processingTimeout = setTimeout(() => {
                    if (!isProcessing) {
                      setIsProcessing(true);
                      checkPronunciation(transcript);
                      setIsProcessing(false);
                    }
                  }, processDelay);
                }
              }
            }
          };

          // Start recognition immediately
          try {
            recognition.start();
            console.log('Recognition started in try block');
          } catch (error) {
            console.error('Error starting recognition:', error);
            setTimeout(() => {
              try {
                recognition.start();
                console.log('Recognition started in catch block');
              } catch (e) {
                console.error('Failed to start recognition in catch block:', e);
              }
            }, 100);
          }

          recognitionRef.current = recognition;
        }
      } else {
        updateGameState('ready');
      }
    } catch (error) {
      console.error('Error starting game:', error);
      setErrorToast('Unable to start the game. Please try again.');
      updateGameState('ready');
      isInitializedRef.current = false;
    } finally {
      setIsStarting(false);
    }
  };

  const endGame = () => {
    updateGameState('finished');
    isInitializedRef.current = false;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setIsListening(false);

    // Mark all unlocked but uncompleted words as skipped
    const updatedWordList = wordListRef.current.map(word => {
      if (word.unlocked && !word.completed) {
        return {
          ...word,
          completed: true,
          skipped: true,
          attempts: (word.attempts || 0) + 1
        };
      }
      return word;
    });

    // Update both ref and state
    wordListRef.current = updatedWordList;
    setWordList(updatedWordList);

    const completedWords = updatedWordList.filter(w => w.completed && !w.skipped).length;
    const totalAttempts = updatedWordList.reduce((acc, word) => acc + (word.attempts || 0), 0);
    const timeSpent = DIFFICULTY_TIME_LIMITS[difficulty] - timeLeft;
    const accuracy = totalAttempts > 0
      ? Math.round((completedWords / totalAttempts) * 100)
      : 0;

    setGameResult({
      wordsCompleted: completedWords,
      timeSpent: timeSpent,
      accuracy: accuracy
    });
  };

  // Update the isSimilarPronunciation function
  const isSimilarPronunciation = (spoken: string, target: string) => {
    if (spoken === target) {
      return true;
    }

    // Clean up the input
    const cleanSpoken = spoken.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    const cleanTarget = target.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    
    if (cleanSpoken === cleanTarget) {
      return true;
    }

    // Check substitutions using the imported data
    if (substitutionsData[target as keyof typeof substitutionsData]?.includes(cleanSpoken)) {
      return true;
    }

    return false;
  };

  // Add this helper function
  const containsInappropriateWords = (text: string): boolean => {
    return profanity.check(text);
  };

  // Modify the checkPronunciation function
  const checkPronunciation = (spokenText: string) => {
    if (containsInappropriateWords(spokenText)) {
      console.log('Inappropriate word detected');
      failureAudio.current.currentTime = 0;
      failureAudio.current.play();
      return;
    }

    setHasSpokenOnce(true);

    if (!spokenText || gameStateRef.current !== 'playing' || !isInitializedRef.current) {
      return;
    }

    const spokenLower = spokenText.toLowerCase().trim();
    const currentWord = wordListRef.current.find(w => w.unlocked && !w.completed);

    if (!currentWord) return;

    const targetLower = currentWord.word.toLowerCase().trim();
    const isCorrect = spokenLower === targetLower || isSimilarPronunciation(spokenLower, targetLower);

    console.log('Speech check:', {
      spoken: spokenLower,
      target: targetLower,
      isCorrect,
      attempts: (currentWord.attempts || 0) + 1
    });

    // Only play sounds if the word hasn't been completed
    if (!currentWord.completed) {
      if (isCorrect) {
        successAudio.current.currentTime = 0;
        successAudio.current.play();
      } else {
        failureAudio.current.currentTime = 0;
        failureAudio.current.play();
      }
    }

    // Always update the word list with the attempt
    const updatedWordList = wordListRef.current.map((word, index) => {
      if (word === currentWord) {
        const newAttempts = (word.attempts || 0) + 1;
        const hadIncorrectAttempt = word.spokenWord && word.spokenWord !== word.word;

        return {
          ...word,
          completed: isCorrect,
          skipped: false,
          spokenWord: hadIncorrectAttempt ? word.spokenWord : spokenLower,
          attempts: newAttempts,
          hadIncorrectAttempt: hadIncorrectAttempt || !isCorrect,
          currentAttemptIncorrect: !isCorrect
        };
      }
      if (index === currentWord.order + 1 && isCorrect) {
        return { ...word, unlocked: true };
      }
      return word;
    });

    wordListRef.current = updatedWordList;
    setWordList(updatedWordList);

    if (isCorrect) {
      setProgress((currentWord.order + 1) * 10);
      setTimeout(() => scrollToActiveWord(currentWord.order + 1), 100);
      if (updatedWordList.every(w => w.completed)) {
        setTimeout(() => endGame(), 500);
      }
    }

    setLastSpokenTimestamp(Date.now());
    setShowInactiveWarning(false);
  };

  // Update toggleListening function
  const toggleListening = () => {
    if (!recognitionRef.current) return;

    try {
      if (isListening) {
        recognitionRef.current.stop();
        isRecognitionActiveRef.current = false;
        setIsListening(false);
      } else {
        if (!isRecognitionActiveRef.current) {
          recognitionRef.current.start();
          isRecognitionActiveRef.current = true;
          setIsListening(true);
        }
      }
    } catch (error) {
      console.error('Speech recognition error:', error);
      isRecognitionActiveRef.current = false;
      setIsListening(false);
    }
  };

  // Update the recognition initialization
  useEffect(() => {
    if (!isSpeechRecognitionSupported()) return;

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      isRecognitionActiveRef.current = true;
    };

    recognition.onend = () => {
      setIsListening(false);
      isRecognitionActiveRef.current = false;
    };

    recognition.onerror = (event: { error: string; }) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      isRecognitionActiveRef.current = false;
    };

    // ... rest of recognition setup ...

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          isRecognitionActiveRef.current = false;
          setIsListening(false);
        } catch (error) {
          console.error('Error stopping recognition:', error);
        }
      }
    };
  }, []);

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const handleSkip = () => {
    if (gameState !== 'playing' || !isInitializedRef.current) return;

    const currentWord = wordListRef.current.find(w => w.unlocked && !w.completed);
    if (!currentWord) return;

    const updatedWordList = wordListRef.current.map((word, index) => {
      if (word === currentWord) {
        return {
          ...word,
          completed: true,
          skipped: true,
          attempts: (word.attempts || 0) + 1
        };
      }
      if (index === currentWord.order + 1) {
        return { ...word, unlocked: true };
      }
      return word;
    });

    wordListRef.current = updatedWordList;
    setWordList(updatedWordList);
    setProgress(((currentWord.order ?? 0) + 1) * 10);

    if (updatedWordList.every(w => w.completed)) {
      setTimeout(() => endGame(), 500);
    }

    setTimeout(() => scrollToActiveWord(currentWord.order + 1), 100);
  };

  // Update close button handler
  const handleClose = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      updateGameState('ready');
      isInitializedRef.current = false;
    } catch (error) {
      console.error('Error closing:', error);
    }
  };

  // Add cleanup for audio
  useEffect(() => {
    return () => {
      successAudio.current.pause();
      failureAudio.current.pause();
    };
  }, []);

  // Inactivity monitor
  useEffect(() => {
    if (gameState !== 'playing' || !isInitializedRef.current || isLoading || hasSpokenOnce) return;

    let hasShownWarning = false;

    const inactivityCheck = setInterval(() => {
      const timeSinceLastSpoken = Date.now() - lastSpokenTimestamp;

      if (timeSinceLastSpoken >= 20000 && !hasShownWarning) {
        setShowInactiveWarning(true);
        hasShownWarning = true;
        toast({
          title: "Ready to Practice?",
          description: "Try pronouncing the highlighted word to continue your session",
          variant: "destructive",
          className: "border-none",
          style: {
            backgroundColor: currentTheme.colors.sub,
            color: currentTheme.colors.text,
          },
        });
      }

      if (timeSinceLastSpoken >= 30000) {
        clearInterval(inactivityCheck);
        endGameDueToInactivity();
      }
    }, 1000);

    return () => clearInterval(inactivityCheck);
  }, [gameState, isInitializedRef.current, lastSpokenTimestamp, isLoading, hasSpokenOnce]);

  // Update endGameDueToInactivity toast
  const endGameDueToInactivity = () => {
    const updatedWordList = wordListRef.current.map(word => {
      if (word.unlocked) {
        return {
          ...word,
          completed: true,
          skipped: true,
          attempts: 1,
          inactivitySkip: true
        };
      }
      return word;
    });

    wordListRef.current = updatedWordList;
    setWordList(updatedWordList);

    toast({
      title: "Session Ended",
      description: "Your session has ended due to inactivity",
      variant: "destructive",
      className: "border-none",
      style: {
        backgroundColor: currentTheme.colors.sub,
        color: currentTheme.colors.text,
      },
    });

    endGame();
  };

  // Add this useEffect near other useEffect hooks
  useEffect(() => {
    // Initialize English dictionary
    profanity.loadDictionary('en');

    // You can add custom words to filter if needed
    profanity.add(['inappropriate', 'words', 'here']);
  }, []);

  // Add this function after your other imports
  const scrollToActiveWord = (wordIndex: number) => {
    const wordElement = document.getElementById(`word-${wordIndex}`);
    if (wordElement) {
      wordElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  };

  // Add this useEffect to scroll to the first word when the game starts
  useEffect(() => {
    if (gameState === 'playing' && !isLoading) {
      setTimeout(() => scrollToActiveWord(0), 100);
    }
  }, [gameState, isLoading]);

  // Update error handling
  useEffect(() => {
    if (errorToast) {
      showToast(errorToast, 'error');
      setErrorToast(null);
    }
  }, [errorToast]);

  useEffect(() => {
    if (apiError) {
      showToast(apiError, 'error');
      setApiError(null);
    }
  }, [apiError]);

  // Add success notifications
  const handleSuccess = (message: string) => {
    showToast(message, 'success');
  };

  // Ready State UI
  if (gameState === 'ready') {
    return (
      <div
        className="min-h-[calc(100vh-3rem)] flex flex-col items-center justify-center p-4"
        style={{ color: currentTheme.colors.text }}
      >
        <div className="w-full max-w-2xl space-y-12">
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-light tracking-wider">
              lingo<span style={{ color: currentTheme.colors.main }}>slide</span>
            </h1>
            <div
              className="inline-flex items-center px-2 py-1 rounded text-xs font-light"
              style={{ backgroundColor: currentTheme.colors.bg, color: currentTheme.colors.sub }}
            >
              BETA
            </div>
          </div>

          {/* Device Warning */}
          {isMobileBrowser() && (
            <div
              className="p-4 rounded text-sm"
              style={{
                color: currentTheme.colors.main,
                opacity: 0.8
              }}
            >
              For the best experience, please use a desktop browser with Chrome.
            </div>
          )}

          {/* Difficulty Selection */}
          <div className="space-y-8">
            <h2
              className="text-lg font-light text-center"
              style={{ color: currentTheme.colors.sub }}
            >
              Select Difficulty
            </h2>

            <ToggleGroup
              type="single"
              value={difficulty}
              onValueChange={(value) => value && setDifficulty(value as Difficulty)}
              className="justify-center"
            >
              {['easy', 'medium', 'hard'].map((level) => (
                <ToggleGroupItem
                  key={level}
                  value={level}
                  className="capitalize text-sm"
                  style={{
                    backgroundColor: difficulty === level ? currentTheme.colors.main : 'transparent',
                    color: difficulty === level ? currentTheme.colors.bg : currentTheme.colors.sub,
                    border: `1px solid ${currentTheme.colors.sub}`,
                    opacity: difficulty === level ? 1 : 0.6
                  }}
                >
                  {level}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {/* Best Practices */}
            <div className="space-y-2">
              <h3
                className="font-medium"
                style={{ color: currentTheme.colors.main }}
              >
                📢 For Best Results
              </h3>
              <ul
                className="text-sm space-y-1"
                style={{ color: currentTheme.colors.sub }}
              >
                <li>• Position microphone close to mouth (4-6 inches)</li>
                <li>• Speak clearly at a normal pace</li>
                <li>• Minimize background noise</li>
                <li>• Pronounce words naturally</li>
              </ul>
            </div>

            {/* Start Button */}
            <div className="flex flex-col items-center gap-6">
              <Button
                size="lg"
                style={{
                  backgroundColor: currentTheme.colors.main,
                  color: currentTheme.colors.bg,
                }}
                className="w-24 h-24 rounded-full hover:opacity-90"
                onClick={startGame}
                disabled={isStarting}
              >
                {isStarting ? (
                  <RefreshCw className="h-8 w-8 animate-spin" />
                ) : (
                  <Play className="h-8 w-8" />
                )}
              </Button>

              <p
                className="text-sm"
                style={{ color: currentTheme.colors.sub }}
              >
                Practice pronunciation with {DIFFICULTY_TIME_LIMITS[difficulty]} seconds timer
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Playing State UI
  if (gameState === 'playing') {
    return (
      <div
        className="min-h-[calc(100vh-3rem)] flex flex-col p-4"
        style={{ color: currentTheme.colors.text }}
      >
        {/* Timer and Progress */}
        <div className="w-full max-w-2xl mx-auto mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-1">
              <Timer className="h-4 w-4" style={{ color: currentTheme.colors.sub }} />
              <span
                style={{
                  color: timeLeft <= 10 ? currentTheme.colors.main : currentTheme.colors.sub
                }}
                className="text-xl font-light"
              >
                {timeLeft}s
              </span>
            </div>
            <span
              style={{ color: currentTheme.colors.sub }}
              className="text-xs font-light"
            >
              {wordList.filter(w => w.completed).length}/{wordList.length}
            </span>
          </div>
          <Progress
            value={progress}
            className="h-0.5"
            style={{
              backgroundColor: `${currentTheme.colors.sub}40`,
              ['--progress-color' as string]: currentTheme.colors.main,
            }}
          />
        </div>

        {/* Current Word */}
        <div
          className="w-full max-w-2xl mx-auto p-3 mb-4 rounded"
          style={{
            backgroundColor: currentTheme.id.includes('light') ||
              currentTheme.id === 'sepia' ||
              currentTheme.id === 'lavender' ||
              currentTheme.id === 'mint'
              ? `${currentTheme.colors.sub}30`
              : currentTheme.colors.sub
          }}
        >
          <div className="text-center">
            <span className="text-2xl font-light tracking-wide">
              {wordList.find(w => w.unlocked && !w.completed)?.word || ''}
            </span>
          </div>
        </div>

        {/* Word List */}
        <div className="w-full max-w-2xl mx-auto flex-1 overflow-hidden">
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-1">
              {wordList.map((item, index) => (
                <div
                  key={index}
                  id={`word-${index}`}
                  className="p-2 rounded transition-all flex items-center"
                  style={{
                    backgroundColor: item.unlocked && !item.completed
                      ? currentTheme.colors.card
                      : 'transparent',
                    opacity: !item.unlocked ? 0.4 : 1,
                    color: item.completed ?
                      (item.hadIncorrectAttempt || item.skipped ? currentTheme.colors.main : currentTheme.colors.success)
                      : currentTheme.colors.text
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 mr-2 hover:opacity-100"
                    style={{
                      color: currentTheme.colors.text,
                      opacity: 0.7
                    }}
                    onClick={() => speak(item.word)}
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </Button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-light tracking-wide">{item.word}</span>
                      <span
                        style={{ color: currentTheme.colors.text }}
                        className="text-xs font-light tracking-wider opacity-60"
                      >
                        {item.phonetic}
                      </span>
                    </div>
                  </div>

                  {item.completed && (
                    item.skipped ? (
                      <X className="h-3 w-3 ml-2" style={{ color: currentTheme.colors.main }} />
                    ) : (
                      <Star className="h-3 w-3 ml-2" style={{ color: currentTheme.colors.success }} />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div
          className="fixed bottom-0 left-0 right-0 p-3 backdrop-blur-sm border-t"
          style={{
            backgroundColor: `${currentTheme.colors.bg}90`,
            borderColor: currentTheme.colors.sub
          }}
        >
          <div className="flex justify-center gap-2 max-w-2xl mx-auto">
            <Button
              size="lg"
              variant="ghost"
              className="h-10 w-10 rounded border"
              style={{
                borderColor: currentTheme.colors.sub,
                color: isListening ? currentTheme.colors.success : currentTheme.colors.text,
                backgroundColor: isListening
                  ? (currentTheme.id.includes('light') ||
                    currentTheme.id === 'sepia' ||
                    currentTheme.id === 'lavender' ||
                    currentTheme.id === 'mint'
                    ? `${currentTheme.colors.sub}30`
                    : currentTheme.colors.sub)
                  : 'transparent'
              }}
              onClick={toggleListening}
            >
              {isListening ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
            </Button>

            <Button
              size="lg"
              variant="ghost"
              className="h-10 w-10 rounded border"
              style={{
                borderColor: currentTheme.colors.sub,
                color: currentTheme.colors.text,
              }}
              onClick={handleSkip}
              disabled={gameState !== 'playing'}
            >
              <SkipForward className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="lg"
              variant="ghost"
              className="h-10 w-10 rounded border"
              style={{
                borderColor: currentTheme.colors.sub,
                color: currentTheme.colors.text,
              }}
              onClick={fetchWords}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="lg"
              variant="ghost"
              className="h-10 w-10 rounded border"
              style={{
                borderColor: currentTheme.colors.sub,
                color: currentTheme.colors.error,
              }}
              onClick={handleClose}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Results State UI
  if (gameState === 'finished' && gameResult) {
    return (
      <div
        className="min-h-[calc(100vh-3rem)] flex flex-col items-center p-4"
        style={{ color: currentTheme.colors.text }}
      >
        <div className="w-full max-w-2xl flex flex-col min-h-screen">
          {/* Sticky Header */}
          <div
            className="sticky top-0 z-10 pt-2 pb-4 -mx-4 px-4"
            style={{ backgroundColor: currentTheme.colors.bg }}
          >
            <h2 className="text-2xl font-light text-center tracking-wider">Practice Summary</h2>
          </div>

          {/* Content with smaller fonts */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {wordList.some(w => w.skipped || w.hadIncorrectAttempt) ? (
              <>
                <h3
                  className="text-base font-light mb-3"
                  style={{ color: currentTheme.colors.sub }}
                >
                  Words to Practice:
                </h3>
                <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
                  <div className="space-y-1">
                    {wordList
                      .filter(w => w.skipped || w.hadIncorrectAttempt)
                      .map((word, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 rounded"
                          style={{
                            backgroundColor: currentTheme.id.includes('light') ||
                              currentTheme.id === 'sepia' ||
                              currentTheme.id === 'lavender' ||
                              currentTheme.id === 'mint'
                              ? `${currentTheme.colors.sub}30`  // More transparent for light themes
                              : currentTheme.colors.sub         // Keep original for dark themes
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 shrink-0 hover:opacity-80"
                              style={{
                                color: currentTheme.colors.text
                              }}
                              onClick={() => speak(word.word)}
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-base font-light tracking-wide">
                              {word.word}
                            </span>
                            {word.skipped && (
                              <span
                                className="text-xs font-light italic tracking-wider"
                                style={{ color: currentTheme.colors.text }}
                              >
                                (skipped)
                              </span>
                            )}
                            {!word.skipped && word.spokenWord && (
                              <span
                                className="text-xs font-light italic tracking-wider truncate"
                                style={{ color: currentTheme.colors.text }}
                              >
                                (you said: {word.spokenWord})
                              </span>
                            )}
                          </div>
                          <span
                            className="text-xs font-light shrink-0 ml-2"
                            style={{ color: currentTheme.colors.text }}
                          >
                            {word.attempts} {word.attempts === 1 ? 'attempt' : 'attempts'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Star
                    className="h-16 w-16 mx-auto"
                    style={{ color: currentTheme.colors.main }}
                  />
                  <div className="space-y-1">
                    <h3 className="text-xl font-light">Perfect Pronunciation!</h3>
                    <p
                      className="text-sm"
                      style={{ color: currentTheme.colors.sub }}
                    >
                      Amazing job! You nailed every word.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="sticky bottom-0 pt-3 pb-2"
            style={{ backgroundColor: currentTheme.colors.bg }}
          >
            <Button
              size="lg"
              onClick={() => {
                setGameState('ready');
                setGameResult(null);
              }}
              className="w-full h-10 text-sm font-light tracking-wider"
              style={{
                backgroundColor: currentTheme.colors.main,
                color: currentTheme.colors.bg,
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Your existing UI code */}
      <Toaster />
    </>
  );
}

export default LinguaSlide; 