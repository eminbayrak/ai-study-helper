import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Button,
  Alert,
  Snackbar,
} from '@mui/material';

// Icons
import {
  Mic as MicIcon,
  MicOff as MicOffIcon,
  SkipNext as SkipNextIcon,
  Refresh as RefreshIcon,
  VolumeUp as VolumeUpIcon,
  Close as CloseIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Star as StarIcon,
} from '@mui/icons-material';

// Assets
import successSound from '../assets/sounds/success.mp3';
import failureSound from '../assets/sounds/failure.mp3';

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

function LinguaSlide() {
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
  const [lastSpokenWord, setLastSpokenWord] = useState('');
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Update fetchWords to use refs
  const fetchWords = async () => {
    try {
      setIsLoading(true);
      setApiError(null);

      // Get all words for the current difficulty
      const allWords = wordData[difficulty];
      
      // Randomly select 10 words
      const selectedWords = [];
      const usedIndexes = new Set();
      
      while (selectedWords.length < 10 && usedIndexes.size < allWords.length) {
        const randomIndex = Math.floor(Math.random() * allWords.length);
        if (!usedIndexes.has(randomIndex)) {
          selectedWords.push(allWords[randomIndex]);
          usedIndexes.add(randomIndex);
        }
      }

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
    setIsStarting(true);
    setHasSpokenOnce(false);
    setLastSpokenWord('');
    
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

          recognition.onerror = (event: any) => {
            console.error('Recognition error:', event.error);
            if (gameStateRef.current === 'playing' && isInitializedRef.current) {
              try {
                recognition.stop();
                setTimeout(() => recognition.start(), 100);
              } catch (error) {
                console.error('Error restarting after error:', error);
              }
            }
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
                  setLastSpokenWord(spokenText);
                  
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

    // Common speech recognition substitutions and homophones
    const substitutions: { [key: string]: string[] } = {
        // Numbers and their word forms
        'tree': ['3', 'three'],
        'four': ['for', '4', 'fore'],
        'two': ['to', 'too', '2'],
        'one': ['won', '1'],
        'eight': ['ate', '8'],
        'six': ['sicks', '6'],
        'seven': ['sevin', '7'],
        'nine': ['9', 'nighn'],
        'ten': ['10', 'tenn'],
        'zero': ['0', 'oh'],
        'and': ['end', 'an', 'ant'],
        'ant': ['and', 'end'],
      
        // Common homophones
        'red': ['read', 'red', 'bread'],
        'dog': ['doe', 'talk', 'dough', 'dock'],
        'read': ['red', 'reed', 'reeded'],
        'big': ['bigh', 'beg'],
        'ball': ['bawl', 'bowl', 'paul'],
        'blue': ['blew'],
        'cup': ['cop', 'cub'],
        'sea': ['see', 'c'],
        'eye': ['i', 'aye'],
        'hi': ['high'],
        'hire': ['higher', 'hier'],
        'hour': ['our', 'are'],
        'meat': ['meet', 'mete'],
        'write': ['right', 'rite', 'wright'],
        'new': ['knew'],
        'know': ['no', 'knowe'],
        'nose': ['knows', 'noze'],
        'way': ['weigh', 'whey'],
        'wait': ['weight', 'waite'],
        'wood': ['would', 'wud'],
        'hear': ['here', 'heir'],
        'there': ['their', "they're"],
        'pair': ['pear', 'pare'],
        'pen': ['pan', 'pam'],
        'bare': ['bear'],
        'wear': ['where', 'ware'],
        'flour': ['flower'],
        'grey': ['gray'],
        'grown': ['groan', 'groan'],
        'hole': ['whole', 'hol'],
        'made': ['maid', 'mayd'],
        'mail': ['male', 'maile'],
        'rain': ['reign', 'rein'],
        'raise': ['rays', 'raze'],
        'run': ['ron', 'rum', 'wrong'],
        'role': ['roll', 'roal'],
        'sale': ['sail', 'sel'],
        'scene': ['seen', 'seene'],
        'steal': ['steel', 'stil'],
        'sweet': ['suite', 'sweat'],
        'sun': ['son', 'song'],
        'tail': ['tale', 'tale'],
        'threw': ['through', 'thru'],
        'tide': ['tied'],
        'toe': ['tow'],
        'weak': ['week', 'weake'],
        'which': ['witch', 'wich'],
        'farm': ['far', 'farn'],
      
        // Similar sounding words
        'accept': ['except'],
        'affect': ['effect'],
        'allowed': ['aloud'],
        'capital': ['capitol'],
        'principal': ['principle'],
        'than': ['then'],
        'weather': ['whether'],
        
        // Added extra cases for improved recognition
        'peace': ['piece', 'pees'],
        'break': ['brake', 'braek'],
        'knight': ['night'],
        'sight': ['site', 'cite'],
        'by': ['buy', 'bye'],
        'plane': ['plain'],
        'be': ['bee'],
        'won': ['one'],
        'lead': ['led'],
        'carat': ['carrot'],
        'cell': ['sell'],
        'male': ['mail'],
        'pear': ['pair'],
        'steak': ['stake'],
        'flower': ['flour'],
        'heel': ['heal'],
        'right': ['write', 'rite', 'wright'],
        'knows': ['nose'],
        'its': ["it's"],
        'your': ["you're", 'yore'],
        'move': ['moove', 'moon'],
        'moon': ['moove', 'move'],
        
      };
      

    // Check substitutions
    if (substitutions[target] && substitutions[target].includes(cleanSpoken)) {
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

  const toggleListening = () => {
    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
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

    // Update both the ref and state
    wordListRef.current = updatedWordList;
    setWordList(updatedWordList);
    setProgress(((currentWord.order ?? 0) + 1) * 10);

    // Check if all words are completed
    if (updatedWordList.every(w => w.completed)) {
      setTimeout(() => endGame(), 500);
    }

    setTimeout(() => scrollToActiveWord(currentWord.order + 1), 100);
  };

  // Update close button handler
  const handleClose = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setLastSpokenWord('');
    updateGameState('ready');
    isInitializedRef.current = false;
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

    const inactivityCheck = setInterval(() => {
      const timeSinceLastSpoken = Date.now() - lastSpokenTimestamp;
      
      // Show warning at 10 seconds of inactivity
      if (timeSinceLastSpoken >= 10000) {
        setShowInactiveWarning(true);
      }
      
      // End game at 20 seconds of inactivity
      if (timeSinceLastSpoken >= 20000) {
        clearInterval(inactivityCheck);
        endGameDueToInactivity();
      }
    }, 1000);

    return () => clearInterval(inactivityCheck);
  }, [gameState, isInitializedRef.current, lastSpokenTimestamp, isLoading, hasSpokenOnce]); // Add hasSpokenOnce dependency

  // Add this function to handle inactivity game end
  const endGameDueToInactivity = () => {
    // Mark all unlocked words as skipped due to inactivity
    const updatedWordList = wordListRef.current.map(word => {
      if (word.unlocked) {
        return {
          ...word,
          completed: true,
          skipped: true,
          attempts: 1,
          inactivitySkip: true // Add this flag to indicate inactivity skip
        };
      }
      return word;
    });
    
    wordListRef.current = updatedWordList;
    setWordList(updatedWordList);
    
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

  if (gameState === 'ready') {
    return (
      <>
        <Box sx={{ 
          maxWidth: {
            xs: '95%',
            sm: 600,
            md: 800
          },
          mx: 'auto', 
          p: { xs: 2, sm: 3 },
          minHeight: 'fit-content',
          bgcolor: 'background.default',
          color: 'text.primary',
        }}>
          <Typography variant="h4" gutterBottom align="center" sx={{ 
            mb: { xs: 2, sm: 4 },
            fontSize: { xs: '1.8rem', sm: '2.125rem' }
          }}>
            Lingua Slide
          </Typography>

          <Card sx={{ 
            p: { xs: 2, sm: 4 },
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            boxShadow: 'none'
          }}>
            <Stack spacing={6} alignItems="center">
              <Typography variant="h6" color="text.secondary">
                Select Difficulty
              </Typography>

              <ToggleButtonGroup
                value={difficulty}
                exclusive
                onChange={(_, newDifficulty) => newDifficulty && setDifficulty(newDifficulty)}
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 4,
                    py: 1.5,
                    fontSize: '1rem',
                    borderColor: 'divider'
                  }
                }}
              >
                <ToggleButton value="easy">Easy</ToggleButton>
                <ToggleButton value="medium">Medium</ToggleButton>
                <ToggleButton value="hard">Hard</ToggleButton>
              </ToggleButtonGroup>

              <Box sx={{ 
                bgcolor: 'rgba(226, 183, 20, 0.1)', 
                p: 2, 
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'primary.main',
                maxWidth: 400,
                textAlign: 'center'
              }}>
                <Typography 
                  variant="subtitle1" 
                  color="primary"
                  sx={{ mb: 1, fontWeight: 500 }}
                >
                  📢 For Best Results
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ lineHeight: 1.6 }}
                >
                  • Position your microphone close to your mouth (4-6 inches)<br />
                  • Speak clearly and at a normal pace<br />
                  • Minimize background noise<br />
                  • Pronounce each word as naturally as possible
                </Typography>
              </Box>

              <IconButton
                sx={{ 
                  width: 100,
                  height: 100,
                  backgroundColor: 'primary.main',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                    transform: 'scale(1.05)'
                  }
                }}
                onClick={startGame}
                disabled={isStarting}
              >
                {isStarting ? (
                  <CircularProgress color="inherit" size={32} />
                ) : (
                  <PlayArrowIcon sx={{ fontSize: 48, color: 'white' }} />
                )}
              </IconButton>

              <Typography 
                variant="body1" 
                color="text.secondary"
                align="center"
                sx={{ maxWidth: 400 }}
              >
                Practice your pronunciation with {DIFFICULTY_TIME_LIMITS[difficulty]} seconds timer
              </Typography>
            </Stack>
          </Card>
        </Box>

        <Snackbar
          open={!!apiError}
          autoHideDuration={6000}
          onClose={() => setApiError(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{ zIndex: 9999 }}
        >
          <Alert 
            onClose={() => setApiError(null)} 
            severity="error"
            sx={{ width: '100%' }}
          >
            {apiError}
          </Alert>
        </Snackbar>

        <Snackbar
          open={showInactiveWarning}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            severity="warning" 
            onClose={() => setShowInactiveWarning(false)}
            sx={{ width: '100%' }}
          >
            Please start speaking! The game will end in a few seconds if no speech is detected.
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!errorToast}
          autoHideDuration={6000}
          onClose={() => setErrorToast(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{ zIndex: 9999 }}
        >
          <Alert 
            onClose={() => setErrorToast(null)} 
            severity="error"
            sx={{ width: '100%' }}
          >
            {errorToast}
          </Alert>
        </Snackbar>
      </>
    );
  }

  if (gameState === 'finished' && gameResult) {
    const hasWordsToReview = wordList.some(w => w.skipped || w.hadIncorrectAttempt);
    const hasInactivitySkip = wordList.some(w => w.inactivitySkip);

    return (
      <Box sx={{ 
        maxWidth: '100%',
        width: 'fit-content',
        minHeight: 'fit-content',
        mx: 'auto', 
        p: 2,
        px: 4,
        pb: 4,
        bgcolor: 'background.paper',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        boxShadow: 'none'
      }}>
        <Typography 
          variant="h4" 
          align="center" 
          gutterBottom
          sx={{ color: 'text.primary', mb: 2 }}
        >
          Practice Summary
        </Typography>

        <Box sx={{ 
          width: '100%',
          minWidth: { xs: '100%', sm: 550, md: 650 },
          maxWidth: { xs: '100%', sm: 650, md: 750 },
          mx: 'auto',
          flex: '1 0 auto',
          mb: 4
        }}>
          {hasWordsToReview ? (
            <>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Words to Practice:
              </Typography>

              <Stack spacing={1}>
                {wordList
                  .filter(w => w.skipped || w.hadIncorrectAttempt)
                  .map((word) => (
                    <Box
                      key={word.order}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        borderBottom: 1,
                        borderColor: 'divider',
                        width: '100%'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <IconButton 
                          onClick={() => speak(word.word)}
                          sx={{ color: 'text.primary' }}
                        >
                          <VolumeUpIcon />
                        </IconButton>
                        <Typography sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                          {word.word}
                          <CloseIcon 
                            sx={{ 
                              color: 'error.main',
                              fontSize: '1rem'
                            }}
                          />
                          {word.skipped && (
                            <Typography 
                              component="span" 
                              sx={{ 
                                color: 'text.secondary',
                                fontStyle: 'italic',
                                ml: 1 
                              }}
                            >
                              (skipped)
                            </Typography>
                          )}
                          {!word.skipped && word.spokenWord && (
                            <Typography 
                              component="span" 
                              sx={{ 
                                color: 'text.secondary',
                                fontStyle: 'italic',
                                ml: 1 
                              }}
                            >
                              (you said: {word.spokenWord})
                            </Typography>
                          )}
                        </Typography>
                      </Box>
                      <Typography 
                        sx={{ 
                          color: 'text.secondary',
                          minWidth: 100,
                          textAlign: 'right'
                        }}
                      >
                        {word.attempts} {word.attempts === 1 ? 'attempt' : 'attempts'}
                      </Typography>
                    </Box>
                  ))}
              </Stack>
            </>
          ) : (
            <Box sx={{ 
              textAlign: 'center', 
              py: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1.5,
              minHeight: 'fit-content'
            }}>
              <StarIcon sx={{ 
                fontSize: 96, 
                color: 'primary.main',
                animation: 'glow 2s ease-in-out infinite alternate'
              }} />
              <Typography variant="h5" sx={{ color: 'text.primary' }}>
                Perfect Pronunciation!
              </Typography>
              <Typography sx={{ 
                color: 'text.secondary',
                fontSize: '1.1rem'
              }}>
                Amazing job! You nailed every word.
              </Typography>
            </Box>
          )}
        </Box>

        <Button
          variant="contained"
          onClick={() => {
            setGameState('ready');
            setGameResult(null);
          }}
          sx={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: '#FF6B6B',
            color: 'white',
            '&:hover': {
              bgcolor: '#FF5252'
            },
            px: 3,
            py: 1,
            borderRadius: 2,
            fontSize: '0.9rem',
            alignSelf: 'center',
            mt: 2
          }}
        >
          <RefreshIcon sx={{ fontSize: '1.2rem' }} />
          Try Again
        </Button>

        {hasInactivitySkip ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="h5" color="error" gutterBottom>
              Game Ended Due to Inactivity
            </Typography>
            <Typography color="text.secondary">
              Remember to speak clearly into your microphone when practicing pronunciation.
            </Typography>
          </Box>
        ) : null}
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ 
        maxWidth: {
          xs: '95%',
          sm: 600,
          md: 800
        },
        mx: 'auto', 
        p: { xs: 2, sm: 3 },
        minHeight: 'fit-content',
        bgcolor: 'background.default',
        color: 'text.primary',
      }}>
        <Typography variant="h4" gutterBottom align="center" sx={{ 
          mb: { xs: 2, sm: 4 },
          fontSize: { xs: '1.8rem', sm: '2.125rem' }
        }}>
          Lingua Slide
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2 
          }}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: timeLeft <= 10 ? 'error.main' : 'text.primary',
                transition: 'color 0.3s',
                fontFamily: 'Roboto Mono, monospace',
              }}
            >
              Time Left: {timeLeft}s
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary"
            >
              Progress: {progress}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: 'primary.main',
                borderRadius: 3,
              }
            }}
          />
        </Box>

        <Card sx={{ 
          p: { xs: 2, sm: 3 },
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: 1,
          borderColor: 'divider',
          boxShadow: 'none',
          mb: { xs: 6, sm: 8 },
          maxHeight: 'calc(100vh - 300px)',
          overflow: 'auto',
          scrollBehavior: 'smooth',
        }}>
          <Stack spacing={2} sx={{ position: 'relative' }}>
            {wordList
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((item, index) => (
                <Card 
                  key={item.order || index}
                  id={`word-${index}`}
                  sx={{ 
                    bgcolor: (!item.completed && item.unlocked) 
                      ? 'action.hover'
                      : 'background.paper',
                    opacity: item.unlocked ? 1 : 0.5,
                    transition: 'all 0.3s',
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: (!item.completed && item.unlocked)
                      ? 'divider'
                      : item.completed && !item.hadIncorrectAttempt && !item.skipped
                        ? 'success.main'
                        : 'warning.main',
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: (!item.completed && item.unlocked)
                        ? 'action.selected'
                        : 'action.hover',
                    }
                  }}
                >
                  <CardContent sx={{ 
                    p: 2,
                    '&:last-child': { pb: 2 }
                  }}>
                    <Stack 
                      direction="row" 
                      spacing={1} 
                      alignItems="center"
                      sx={{ 
                        flexWrap: 'nowrap',
                        minWidth: 0
                      }}
                    >
                      <IconButton 
                        onClick={() => speak(item.word)}
                        size="small"
                      >
                        <VolumeUpIcon />
                      </IconButton>
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: 0.5,
                        minWidth: 0,
                        flex: 1
                      }}>
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1
                        }}>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              flexShrink: 0,
                              fontSize: '1.1rem'
                            }}
                          >
                            {item.word}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ 
                              flexShrink: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            ({item.phonetic})
                          </Typography>
                        </Box>
                      </Box>
                      {item.completed && (
                        item.skipped ? (
                          <CloseIcon 
                            sx={{ 
                              flexShrink: 0,
                              color: 'error.main'
                            }}
                          />
                        ) : (
                          <CheckCircleIcon 
                            color="success" 
                            sx={{ flexShrink: 0 }}
                          />
                        )
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
          </Stack>
        </Card>

        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            py: { xs: 1.5, sm: 2 },
            px: { xs: 2, sm: 3 },
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'center',
            gap: { xs: 1, sm: 2 },
            zIndex: 1000,
            boxShadow: 'none'
          }}
        >
          <IconButton
            sx={{ 
              width: { xs: 48, sm: 56 },
              height: { xs: 48, sm: 56 },
              bgcolor: isListening ? 'secondary.main' : '#4CAF50',
              color: 'white',
              '&:hover': {
                bgcolor: isListening ? 'secondary.dark' : '#45a049',
              }
            }}
            onClick={toggleListening}
          >
            {isListening ? <MicIcon /> : <MicOffIcon />}
          </IconButton>

          <IconButton 
            onClick={handleSkip}
            disabled={gameState !== 'playing' || !isInitializedRef.current}
            sx={{ 
              width: { xs: 48, sm: 56 },
              height: { xs: 48, sm: 56 },
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
              '&.Mui-disabled': {
                backgroundColor: 'action.disabledBackground',
                color: 'action.disabled'
              }
            }}
          >
            <SkipNextIcon />
          </IconButton>

          <IconButton 
            onClick={fetchWords}
            sx={{ 
              width: { xs: 48, sm: 56 },
              height: { xs: 48, sm: 56 },
              backgroundColor: 'primary.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'primary.dark',
              }
            }}
          >
            <RefreshIcon />
          </IconButton>

          <IconButton 
            onClick={handleClose}
            sx={{ 
              width: { xs: 48, sm: 56 },
              height: { xs: 48, sm: 56 },
              backgroundColor: 'error.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'error.dark',
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Snackbar
          open={showInactiveWarning}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            severity="warning" 
            onClose={() => setShowInactiveWarning(false)}
            sx={{ width: '100%' }}
          >
            Please start speaking! The game will end in a few seconds if no speech is detected.
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!errorToast}
          autoHideDuration={6000}
          onClose={() => setErrorToast(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{ zIndex: 9999 }}
        >
          <Alert 
            onClose={() => setErrorToast(null)} 
            severity="error"
            sx={{ width: '100%' }}
          >
            {errorToast}
          </Alert>
        </Snackbar>
      </Box>
    </>
  );
}

export default LinguaSlide; 