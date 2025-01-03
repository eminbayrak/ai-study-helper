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
  Globe2,
  ChevronDown,
} from "lucide-react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../components/ui/toggle-group";
import { useTheme } from '../contexts/ThemeContext';
import { Toaster } from "../components/ui/toaster";
import { toast } from "../hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import substitutionsData from '../data/substitutions.json';

// Assets
import successSoundFile from '../assets/sounds/success.mp3';
import failureSoundFile from '../assets/sounds/failure.mp3';

const successSound = successSoundFile;
const failureSound = failureSoundFile;

// Types
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'ready' | 'playing' | 'finished';
type Timeout = ReturnType<typeof setTimeout>;
type Language = 'en' | 'ja' | 'tr' | 'es';

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
  meaning?: string;
  furigana?: string;
}

interface GameResult {
  wordsCompleted: number;
  timeSpent: number;
  accuracy: number;
}

interface LanguageConfig {
  code: string;
  name: string;
  recognition: string;
  displayName: string;
}

// Constants
const DIFFICULTY_TIME_LIMITS: Record<Difficulty, number> = {
  easy: 45,
  medium: 60,
  hard: 75,
};

const SUPPORTED_LANGUAGES: Record<Language, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    recognition: 'en-US',
    displayName: 'English',
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    recognition: 'ja-JP',
    displayName: '日本語',
  },
  tr: {
    code: 'tr',
    name: 'Turkish',
    recognition: 'tr-TR',
    displayName: 'Türkçe',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    recognition: 'es-ES',
    displayName: 'Español',
  },
};

import profanity from 'leo-profanity';

// Add these helper functions at the top of your file
const isMobileBrowser = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const isSpeechRecognitionSupported = () => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

// Add a helper function to determine if a language needs phonetic display
const needsPhonetic = (language: Language): boolean => {
  return language === 'ja'; // Only Japanese needs phonetic for now
};

interface WordData {
  word: string;
  meaning: string;
  romaji?: string;
  furigana?: string;
}

// Add type guard function
const isWordData = (word: string | WordData): word is WordData => {
  return typeof word !== 'string' && 'word' in word;
};

interface WordDataStructure {
  easy: (WordData | string)[];
  medium: (WordData | string)[];
  hard: (WordData | string)[];
}

// Add dynamic import function
const loadWordData = async (language: Language) => {
  try {
    switch (language) {
      case 'en':
        return (await import('../data/words.json')).default;
      case 'ja':
        return (await import('../data/words_ja.json')).default;
      case 'tr':
        return (await import('../data/words_tr.json')).default;
      case 'es':
        return (await import('../data/words_sp.json')).default;
      default:
        throw new Error('Unsupported language');
    }
  } catch (error) {
    console.error('Error loading word data:', error);
    throw error;
  }
};

// Add this helper at the top of the file
const isDev = import.meta.env.DEV;

// Add a debug logger function
const debugLog = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
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
  const [hasSpokenOnce, setHasSpokenOnce] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [usedWords, setUsedWords] = useState<Set<WordData | string>>(new Set());
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');

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
        backgroundColor: currentTheme.colors.card,
        color: currentTheme.colors.main,
        border: `1px solid ${currentTheme.colors.main}40`,
      },
    });
  };

  // Update fetchWords to use dynamic loading
  const fetchWords = async () => {
    try {
      setIsLoading(true);
      setApiError(null);

      // Load word data dynamically
      const currentWordData = (await loadWordData(selectedLanguage)) as WordDataStructure;

      // Add safety check
      if (!currentWordData || !currentWordData[difficulty]) {
        throw new Error(`No words available for ${difficulty} difficulty in ${selectedLanguage}`);
      }

      const allWords = currentWordData[difficulty];

      if (selectedLanguage === 'ja') {
        try {
          // Filter words based on difficulty only
          const availableWords = allWords.filter((word: WordData | string) => {
            if (typeof word === 'string') return false;
            
            if (difficulty === 'easy') {
              // For easy: show only words with furigana
              return word.furigana;
            }
            // For medium and hard: use the predefined sets in the JSON
            return true;
          });

          // If we're running low on unused words, reset the used words
          if (availableWords.length < 10) {
            setUsedWords(new Set());
            const resetWords = allWords.filter((word: WordData | string) => {
              if (!isWordData(word)) return false;
              
              if (difficulty === 'easy') {
                return word.furigana && (word.level === 5 || !word.level);
              } else if (difficulty === 'medium') {
                return word.level === 4 || word.level === 3;
              } else {
                return word.level === 2 || word.level === 1;
              }
            });
            availableWords.push(...resetWords);
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

          setUsedWords(newUsedWords);

          const initialWords = selectedWords.map((word, index) => {
            if (!isWordData(word)) return {
              word: String(word),
              phonetic: String(word).toLowerCase(),
              meaning: undefined,
              completed: false,
              unlocked: index === 0,
              order: index,
              attempts: 0,
              hadIncorrectAttempt: false,
              currentAttemptIncorrect: false
            };

            // Different handling for Japanese vs other languages
            if (selectedLanguage === 'ja' as Language) {
              return {
                word: difficulty === 'easy' ? word.furigana! : word.word,
                phonetic: word.romaji || '',
                meaning: word.meaning,
                furigana: difficulty !== 'easy' ? word.furigana : undefined,
                completed: false,
                unlocked: index === 0,
                order: index,
                attempts: 0,
                hadIncorrectAttempt: false,
                currentAttemptIncorrect: false
              };
            }

            // For Turkish and other languages
            return {
              word: word.word,
              phonetic: word.word.toLowerCase(),
              meaning: word.meaning,
              completed: false,
              unlocked: index === 0,
              order: index,
              attempts: 0,
              hadIncorrectAttempt: false,
              currentAttemptIncorrect: false
            };
          });

          wordListRef.current = initialWords;
          setWordList(initialWords);
        } catch (error) {
          console.error('Error in Japanese words setup:', error);
          setApiError('Failed to load Japanese words. Please try again.');
          return false;
        }
      } else {
        // Filter out previously used words
        const availableWords = allWords.filter((word: WordData | string) => {
          if (typeof word === 'string') {
            return !usedWords.has(word);
          }
          return !usedWords.has(word) && (!difficulty || difficulty !== 'easy' || word.furigana);
        });
        
        // If we're running low on unused words, reset the used words
        if (availableWords.length < 10) {
          setUsedWords(new Set());
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

        setUsedWords(newUsedWords);

        const initialWords = selectedWords.map((word, index) => {
          if (!isWordData(word)) return {
            word: String(word),
            phonetic: String(word).toLowerCase(),
            meaning: undefined,
            completed: false,
            unlocked: index === 0,
            order: index,
            attempts: 0,
            hadIncorrectAttempt: false,
            currentAttemptIncorrect: false
          };

          // Different handling for Japanese vs other languages
          if (selectedLanguage === 'ja' as Language) {
            return {
              word: difficulty === 'easy' ? word.furigana! : word.word,
              phonetic: word.romaji || '',
              meaning: word.meaning,
              furigana: difficulty !== 'easy' ? word.furigana : undefined,
              completed: false,
              unlocked: index === 0,
              order: index,
              attempts: 0,
              hadIncorrectAttempt: false,
              currentAttemptIncorrect: false
            };
          }

          // For Turkish and other languages
          return {
            word: word.word,
            phonetic: word.word.toLowerCase(),
            meaning: word.meaning,
            completed: false,
            unlocked: index === 0,
            order: index,
            attempts: 0,
            hadIncorrectAttempt: false,
            currentAttemptIncorrect: false
          };
        });
        
        wordListRef.current = initialWords;
        setWordList(initialWords);
      }

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

  // Update the startGame function's recognition setup
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

        // Initialize speech recognition
        if ('webkitSpeechRecognition' in window) {
          // Stop any existing recognition
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }

          const recognition = new (window as any).webkitSpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;
          recognition.lang = SUPPORTED_LANGUAGES[selectedLanguage].recognition;

          recognition.onstart = () => {
            setIsListening(true);
            isRecognitionActiveRef.current = true;
            debugLog('Speech recognition started');
          };

          recognition.onend = () => {
            setIsListening(false);
            debugLog('Speech recognition ended');
            // Only restart if game is still playing and not manually stopped
            if (gameStateRef.current === 'playing' && isInitializedRef.current && !recognition.stopping) {
              try {
                setTimeout(() => {
                  recognition.start();
                }, 300);
              } catch (error) {
                console.error('Error restarting recognition:', error);
              }
            }
          };

          recognition.onerror = (event: { error: string; }) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
              return;
            }
            setIsListening(false);
            isRecognitionActiveRef.current = false;
          };

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
                  debugLog('Spoken word:', spokenText);
                  
                  if (!isProcessing) {
                    setIsProcessing(true);
                    checkPronunciation(spokenText);
                    setIsProcessing(false);
                  }
                }
              }
            }
          };

          recognition.stopping = false;
          recognitionRef.current = recognition;

          // Start recognition immediately
          try {
            recognition.start();
            debugLog('Recognition started initially');
          } catch (error) {
            console.error('Error starting recognition:', error);
            setTimeout(() => {
              try {
                recognition.start();
                debugLog('Recognition started after delay');
              } catch (e) {
                console.error('Failed to start recognition after delay:', e);
                showToast('Failed to start speech recognition', 'error');
              }
            }, 300);
          }
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
    // Clean up the inputs
    const cleanSpoken = spoken.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim().toLowerCase();
    const cleanTarget = target.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim().toLowerCase();
    
    // Special handling for Japanese
    if (selectedLanguage === 'ja') {
      debugLog('Comparing Japanese:', { cleanSpoken, cleanTarget });
      
      // Convert to basic form (remove long vowels, standardize characters)
      const standardize = (text: string) => {
        return text
          .replace(/ā|â/g, 'a').replace(/ī|î/g, 'i').replace(/ū|û/g, 'u')
          .replace(/ē|ê/g, 'e').replace(/ō|ô/g, 'o')
          .replace(/ー/g, '')
          .replace(/[\s\-]/g, '')
          .replace(/[っつ]/g, 'tsu')
          .replace(/[づず]/g, 'zu')
          .replace(/[ぢじ]/g, 'ji')
          .replace(/[をお]/g, 'o')
          .replace(/[へえ]/g, 'e')
          .replace(/[わ]/g, 'wa')
          .replace(/[ゐ]/g, 'i')
          .replace(/[ゑ]/g, 'e')
          .replace(/[ん]/g, 'n');
      };

      const normalizedSpoken = standardize(cleanSpoken);
      const normalizedTarget = standardize(cleanTarget);
      
      debugLog('Normalized:', { normalizedSpoken, normalizedTarget });

      // Direct match
      if (normalizedSpoken === normalizedTarget) return true;

      // Check if one contains the other
      if (normalizedSpoken.includes(normalizedTarget) || 
          normalizedTarget.includes(normalizedSpoken)) return true;

      // Very lenient similarity check for Japanese
      let matchCount = 0;
      const spokenChars = normalizedSpoken.split('');
      const targetChars = normalizedTarget.split('');
      
      spokenChars.forEach(char => {
        if (targetChars.includes(char)) matchCount++;
      });

      const similarity = matchCount / Math.max(spokenChars.length, targetChars.length);
      debugLog('Similarity score:', similarity);

      // Be very lenient with Japanese - accept if 40% or more characters match
      return similarity >= 0.4;
    }

    // For other languages, use stricter matching
    return cleanSpoken === cleanTarget || 
           substitutionsData[cleanTarget as keyof typeof substitutionsData]?.includes(cleanSpoken);
  };

  // Add this helper function
  const containsInappropriateWords = (text: string): boolean => {
    return profanity.check(text);
  };

  // Modify the checkPronunciation function
  const checkPronunciation = (spokenText: string) => {
    if (!isInitializedRef.current || gameStateRef.current !== 'playing') return;

    const currentWord = wordListRef.current.find(w => w.unlocked && !w.completed);
    if (!currentWord) return;

    const cleanSpoken = spokenText.toLowerCase().trim();
    const target = currentWord.word.toLowerCase().trim();

    debugLog('Checking pronunciation:', { spoken: cleanSpoken, target, currentWord });

    // Check exact match or similar pronunciation
    if (cleanSpoken === target || isSimilarPronunciation(cleanSpoken, target)) {
      handleCorrectPronunciation(currentWord);
    } else {
      handleIncorrectPronunciation(currentWord, cleanSpoken);
    }
  };

  const handleCorrectPronunciation = (currentWord: WordStatus) => {
    debugLog('Correct pronunciation!', currentWord);
    
    // Play success sound
    successAudio.current.currentTime = 0;
    successAudio.current.play().catch(console.error);

    const updatedWords = wordListRef.current.map(word => {
      if (word.order === currentWord.order) {
        return { ...word, completed: true };
      }
      if (word.order === currentWord.order + 1) {
        return { ...word, unlocked: true };
      }
      return word;
    });

    wordListRef.current = updatedWords;
    setWordList(updatedWords);
    setProgress((currentWord.order + 1) * 10);
    setHasSpokenOnce(true);
    setLastSpokenTimestamp(Date.now());

    // Check if game is complete
    if (updatedWords.every(w => w.completed)) {
      setTimeout(() => endGame(), 500);
    } else {
      // Scroll to next word
      setTimeout(() => scrollToActiveWord(currentWord.order + 1), 100);
    }
  };

  const handleIncorrectPronunciation = (currentWord: WordStatus, spokenText: string) => {
    debugLog('Incorrect pronunciation!', { currentWord, spokenText });
    
    // Play failure sound
    failureAudio.current.currentTime = 0;
    failureAudio.current.play().catch(console.error);

    const updatedWords = wordListRef.current.map(word => {
      if (word.order === currentWord.order) {
        return {
          ...word,
          attempts: word.attempts + 1,
          hadIncorrectAttempt: true,
          currentAttemptIncorrect: true,
          spokenWord: spokenText
        };
      }
      return word;
    });

    wordListRef.current = updatedWords;
    setWordList(updatedWords);
    setHasSpokenOnce(true);
    setLastSpokenTimestamp(Date.now());
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

  const speak = (text: string) => {
    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set language based on selected language
      switch (selectedLanguage) {
        case 'tr':
          utterance.lang = 'tr-TR';
          break;
        case 'ja':
          utterance.lang = 'ja-JP';
          break;
        case 'es':
          utterance.lang = 'es-ES';
          break;
        default:
          utterance.lang = 'en-US';
      }

      // Optional: Adjust speech rate and pitch
      utterance.rate = 0.9;  // Slightly slower
      utterance.pitch = 1;   // Normal pitch

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Speech synthesis error:', error);
      showToast('Unable to speak the word', 'error');
    }
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
        hasShownWarning = true;
        toast({
          title: "Ready to Practice?",
          description: "Try pronouncing the highlighted word to continue your session",
          variant: "destructive",
          className: "border-none",
          style: {
            backgroundColor: currentTheme.colors.card,
            color: currentTheme.colors.main,
            border: `1px solid ${currentTheme.colors.main}40`,
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
        backgroundColor: currentTheme.colors.card,
        color: currentTheme.colors.main,
        border: `1px solid ${currentTheme.colors.main}40`,
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

          {/* Add Language Selector here */}
          <div className="flex justify-center items-center gap-2 mb-8">
            <Globe2 
              className="h-5 w-5"
              style={{ color: currentTheme.colors.main }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="text-base font-medium px-3 h-8 flex items-center gap-2 hover:bg-opacity-20 hover:bg-white transition-colors"
                  style={{ 
                    color: currentTheme.colors.main,
                    borderRadius: '4px',
                  }}
                >
                  {SUPPORTED_LANGUAGES[selectedLanguage].name.toLowerCase()}
                  <ChevronDown className="h-4 w-4 opacity-80" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                style={{
                  backgroundColor: currentTheme.colors.card,
                  border: `1px solid ${currentTheme.colors.main}40`,
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                }}
              >
                {Object.entries(SUPPORTED_LANGUAGES).map(([code, config]) => (
                  <DropdownMenuItem
                    key={code}
                    onClick={() => setSelectedLanguage(code as Language)}
                    className="text-base font-medium hover:bg-opacity-10 hover:bg-white transition-colors"
                    style={{
                      color: currentTheme.colors.main,
                      padding: '8px 12px',
                    }}
                  >
                    {config.displayName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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
        {/* Sticky Header Container */}
        <div 
          className="sticky top-0 z-10 bg-opacity-80 backdrop-blur-sm -mx-4 px-4 pb-2"
          style={{ 
            backgroundColor: currentTheme.colors.bg,
            top: '3rem',
          }}
        >
          {/* Timer and Progress */}
          <div className="w-full max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              {/* Timer */}
              <div className="flex items-center gap-1">
                <Timer 
                  className="h-4 w-4" 
                  style={{ color: currentTheme.colors.main }}
                />
                <span
                  style={{
                    color: timeLeft <= 10 ? currentTheme.colors.error : currentTheme.colors.main
                  }}
                  className="text-xl font-light"
                >
                  {timeLeft}s
                </span>
              </div>

              {/* Current Word - Moved between timer and progress */}
              <div className="flex-1 text-center mx-4">
                <span className="text-xl font-light tracking-wider">
                  {wordList.find(w => w.unlocked && !w.completed)?.word || ''}
                </span>
              </div>

              {/* Progress Counter */}
              <span
                style={{ color: currentTheme.colors.main }}
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
        </div>

        {/* Word List - Adjust spacing and height */}
        <div className="w-full max-w-2xl mx-auto flex-1 overflow-hidden mt-8">
          <div className="h-full flex flex-col">
            <div 
              className="flex-1 overflow-y-auto space-y-2 pb-28 pt-2"
              style={{
                maxHeight: 'calc(100vh - 14rem)',
              }}
            >
              {wordList.map((item, index) => (
                <div
                  key={index}
                  id={`word-${index}`}
                  className="p-2.5 rounded transition-all flex items-center"
                  style={{
                    backgroundColor: item.unlocked && !item.completed
                      ? currentTheme.colors.card
                      : 'transparent',
                    opacity: !item.unlocked ? 0.4 : 1,
                    color: item.completed
                      ? (item.hadIncorrectAttempt || item.skipped 
                        ? currentTheme.colors.error 
                        : currentTheme.colors.success)
                      : currentTheme.colors.text,
                    border: item.unlocked && !item.completed 
                      ? `1px solid ${currentTheme.colors.main}40`
                      : 'none',
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 mr-2 hover:opacity-100"
                    style={{
                      color: currentTheme.colors.main,
                      opacity: 0.8
                    }}
                    onClick={() => speak(item.word)}
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </Button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium tracking-wide">
                        {item.word}
                      </span>
                      {item.furigana && (
                        <span
                          className="text-xs font-light"
                          style={{ color: currentTheme.colors.sub }}
                        >
                          ({item.furigana})
                        </span>
                      )}
                      {needsPhonetic(selectedLanguage) && (
                        <span className="text-xs font-light tracking-wider">
                          {item.phonetic}
                        </span>
                      )}
                      {(selectedLanguage === 'ja' || selectedLanguage === 'tr' || selectedLanguage === 'es') && item.meaning && (
                        <span className="text-xs font-light tracking-wider opacity-80">
                          ({item.meaning})
                        </span>
                      )}
                    </div>
                  </div>

                  {item.completed && (
                    item.skipped ? (
                      <X 
                        className="h-3.5 w-3.5 ml-2"
                        style={{ color: currentTheme.colors.error }} 
                      />
                    ) : (
                      <Star 
                        className="h-3.5 w-3.5 ml-2"
                        style={{ color: currentTheme.colors.success }} 
                      />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Control Buttons - Keep at bottom */}
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
                backgroundColor: isListening ? `${currentTheme.colors.success}20` : 'transparent',
                transition: 'all 0.2s ease'
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
                          className="p-2.5 rounded"
                          style={{
                            border: `1px solid ${currentTheme.colors.sub}40`,
                          }}
                        >
                          <div className="flex items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 shrink-0 mr-2 hover:opacity-80"
                              style={{
                                color: currentTheme.colors.text
                              }}
                              onClick={() => speak(word.word)}
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </Button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-medium tracking-wide">
                                  {word.word}
                                </span>
                                {word.furigana && (
                                  <span
                                    className="text-xs font-light"
                                    style={{ color: currentTheme.colors.sub }}
                                  >
                                    ({word.furigana})
                                  </span>
                                )}
                                {needsPhonetic(selectedLanguage) && (
                                  <span className="text-xs font-light tracking-wider">
                                    {word.phonetic}
                                  </span>
                                )}
                                {(selectedLanguage === 'ja' || selectedLanguage === 'tr' || selectedLanguage === 'es') && word.meaning && (
                                  <span className="text-xs font-light tracking-wider opacity-80">
                                    ({word.meaning})
                                  </span>
                                )}
                                {word.skipped ? (
                                  <span className="text-xs font-light italic">
                                    (skipped)
                                  </span>
                                ) : word.spokenWord && (
                                  <span className="text-xs font-light italic truncate">
                                    (you said: {word.spokenWord})
                                  </span>
                                )}
                                <span className="text-xs font-light shrink-0">
                                  {word.attempts} {word.attempts === 1 ? 'attempt' : 'attempts'}
                                </span>
                              </div>
                            </div>
                          </div>
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