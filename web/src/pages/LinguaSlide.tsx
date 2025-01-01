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
  Alert,
  Button,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import RefreshIcon from '@mui/icons-material/Refresh';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'ready' | 'playing' | 'finished';

interface WordStatus {
  word: string;
  phonetic: string;
  completed: boolean;
  unlocked: boolean;
  spokenWord?: string;
  skipped?: boolean;
  attempts?: number;
  order: number;
  hadIncorrectAttempt?: boolean;
  currentAttemptIncorrect?: boolean;
}

interface GameResult {
  wordsCompleted: number;
  timeSpent: number;
  accuracy: number;
}

const DIFFICULTY_TIME_LIMITS = {
  easy: 30,
  medium: 40,
  hard: 50,
};

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
  const [lastSpokenWord, setLastSpokenWord] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

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

  // Update fetchWords to use refs
  const fetchWords = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/words/random`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch words');
      }

      const data = await response.json();
      
      const initialWords = data[difficulty].map((word: string, index: number) => ({
        word,
        phonetic: word.toLowerCase()
          .replace(/([aeiou])/g, '$1·')
          .split('')
          .join('‧')
          .replace(/‧$/,''),
        completed: false,
        unlocked: index === 0,
        order: index
      }));
      
      wordListRef.current = initialWords;
      setWordList(initialWords);
      setProgress(0);
    } catch (error) {
      console.error('Error fetching words:', error);
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

  const startGame = async () => {
    setIsStarting(true);
    try {
      // Reset states
      isInitializedRef.current = false;
      wordListRef.current = [];
      setWordList([]);
      
      // Fetch words first
      await fetchWords();
      
      // Set states after words are fetched
      setTimeLeft(DIFFICULTY_TIME_LIMITS[difficulty]);
      setProgress(0);
      
      // Update game state
      updateGameState('playing');
      isInitializedRef.current = true;
      setIsInitialized(true);

      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Initialize speech recognition
      if ('webkitSpeechRecognition' in window) {
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          console.log('Speech recognition started, states:', {
            gameState: gameStateRef.current,
            isInitialized: isInitializedRef.current,
            wordListLength: wordListRef.current.length
          });
          setIsListening(true);
        };

        recognition.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
          if (gameStateRef.current === 'playing' && isInitializedRef.current) {
            try {
              recognition.start();
            } catch (error) {
              console.error('Error restarting recognition:', error);
            }
          }
        };

        recognition.onresult = (event: any) => {
          const text = event.results[event.results.length - 1][0].transcript;
          console.log('Speech recognition result:', text);
          if (gameStateRef.current === 'playing' && isInitializedRef.current) {
            setLastSpokenWord(text.toLowerCase().trim());
            checkPronunciation(text);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      }
    } catch (error) {
      console.error('Error starting game:', error);
      updateGameState('ready');
      isInitializedRef.current = false;
      setIsInitialized(false);
    } finally {
      setIsStarting(false);
    }
  };

  const endGame = () => {
    updateGameState('finished');
    isInitializedRef.current = false;
    setIsInitialized(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    setIsListening(false);
    
    const completedWords = wordListRef.current.filter(w => w.completed && !w.skipped).length;
    const totalAttempts = wordListRef.current.reduce((acc, word) => acc + (word.attempts || 0), 0);
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
    console.log('Checking similarity:', { spoken, target });

    // Direct match
    if (spoken === target) {
      console.log('Direct match found');
      return true;
    }

    // Clean up the input
    const cleanSpoken = spoken.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    const cleanTarget = target.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    
    if (cleanSpoken === cleanTarget) {
      console.log('Match found after cleaning');
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
      
        // Common homophones
        'red': ['read', 'red'],
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
        'grown': ['groan', 'groan'],
        'hole': ['whole', 'hol'],
        'made': ['maid', 'mayd'],
        'mail': ['male', 'maile'],
        'rain': ['reign', 'rein'],
        'raise': ['rays', 'raze'],
        'run': ['ron', 'rum'],
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
      };
      

    // Check substitutions
    if (substitutions[target] && substitutions[target].includes(cleanSpoken)) {
      console.log('Substitution match found');
      return true;
    }

    // Do NOT check for partial matches anymore
    console.log('No match found');
    return false;
  };

  // Update the checkPronunciation function with more detailed logging
  const checkPronunciation = (spokenText: string) => {
    console.log('Checking pronunciation:', { 
      spokenText, 
      gameState: gameStateRef.current, 
      isInitialized: isInitializedRef.current,
      wordListLength: wordListRef.current.length
    });
    
    if (!spokenText || gameStateRef.current !== 'playing' || !isInitializedRef.current) {
      console.log('Invalid state for pronunciation check:', { 
        spokenText, 
        gameState: gameStateRef.current, 
        isInitialized: isInitializedRef.current
      });
      return;
    }
    
    const spokenLower = spokenText.toLowerCase().trim();
    const currentWord = wordListRef.current.find(w => w.unlocked && !w.completed);
    
    if (!currentWord) return;

    const targetLower = currentWord.word.toLowerCase().trim();
    const isCorrect = spokenLower === targetLower || isSimilarPronunciation(spokenLower, targetLower);

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
      if (updatedWordList.every(w => w.completed)) {
        setTimeout(() => endGame(), 500);
      }
    }
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
    if (gameState !== 'playing' || !isInitialized) return;
    
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
  };

  // Update close button handler
  const handleClose = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    updateGameState('ready');
    isInitializedRef.current = false;
    setIsInitialized(false);
  };

  if (gameState === 'ready') {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Lingua Slide
        </Typography>
        
        <Stack spacing={3} alignItems="center">
          <ToggleButtonGroup
            value={difficulty}
            exclusive
            onChange={(_, newDifficulty) => newDifficulty && setDifficulty(newDifficulty)}
          >
            <ToggleButton value="easy">Easy</ToggleButton>
            <ToggleButton value="medium">Medium</ToggleButton>
            <ToggleButton value="hard">Hard</ToggleButton>
          </ToggleButtonGroup>

          <IconButton
            sx={{ 
              width: 80, 
              height: 80, 
              backgroundColor: 'primary.main',
              '&:hover': { backgroundColor: 'primary.dark' }
            }}
            onClick={startGame}
            disabled={isStarting}
          >
            {isStarting ? (
              <CircularProgress color="inherit" size={24} />
            ) : (
              <PlayArrowIcon sx={{ fontSize: 40, color: 'white' }} />
            )}
          </IconButton>
        </Stack>
      </Box>
    );
  }

  if (gameState === 'finished' && gameResult) {
    const hasWordsToReview = wordList.some(w => w.skipped || w.hadIncorrectAttempt);

    return (
      <Box sx={{ 
        maxWidth: '100%',
        width: 'fit-content',
        minHeight: 'fit-content',
        mx: 'auto', 
        p: 2,
        px: 4,
        bgcolor: 'background.paper',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        boxShadow: 1
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
          mb: 6
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
              <CheckCircleIcon sx={{ 
                fontSize: 64, 
                color: 'primary.main' 
              }} />
              <Typography variant="h4" sx={{ color: 'text.primary' }}>
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

        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            py: 1,
            px: 2,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
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
              fontSize: '0.9rem'
            }}
          >
            <RefreshIcon sx={{ fontSize: '1.2rem' }} />
            Try Again
          </Button>
        </Box>

        <Box sx={{ height: 48 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      maxWidth: 800,
      mx: 'auto', 
      p: 2,
      minHeight: '100vh',
      bgcolor: 'background.default',
      color: 'text.primary',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Typography variant="h4" gutterBottom>
        Lingua Slide
      </Typography>

      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Time Left: {timeLeft}s
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={(progress / 100) * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: 'primary.main',
              }
            }}
          />
        </Box>

        {isLoading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Loading words...</Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {wordList
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((item, index) => (
                <Card 
                  key={item.order || index}
                  sx={{ 
                    bgcolor: 'background.paper',
                    opacity: item.unlocked ? 1 : 0.5,
                    transition: 'all 0.3s',
                    border: (!item.completed && item.unlocked) 
                      ? item.currentAttemptIncorrect 
                        ? '2px solid #ff4444'  // Red border for incorrect attempt
                        : '2px solid #4caf50'  // Green border for current word
                      : 'none',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    }
                  }}
                >
                  <CardContent sx={{ 
                    p: 1,
                    '&:last-child': { pb: 1 }
                  }}>
                    <Stack 
                      direction="row" 
                      spacing={1} 
                      alignItems="center"
                      sx={{ 
                        flexWrap: 'nowrap',
                        minWidth: 0 // Enable text truncation
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
                        alignItems: 'center', 
                        gap: 1,
                        minWidth: 0, // Enable text truncation
                        flex: 1
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
        )}

        <Stack 
          direction="row" 
          spacing={2} 
          justifyContent="center"
          sx={{ 
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            py: 2,
            px: 3,
            bgcolor: 'background.default',
            borderTop: 1,
            borderColor: 'divider',
            zIndex: 1000
          }}
        >
          <IconButton
            sx={{ 
              width: 56,
              height: 56,
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
            color="primary"
            onClick={handleSkip}
            disabled={gameState !== 'playing' || !isInitialized}
            sx={{ 
              width: 48, 
              height: 48,
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
            color="primary" 
            onClick={fetchWords}
            sx={{ 
              width: 48, 
              height: 48,
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
            sx={{ 
              width: 48, 
              height: 48,
              backgroundColor: 'error.main',
              color: 'white',
              '&:hover': {
                backgroundColor: 'error.dark',
              }
            }}
            onClick={handleClose}
          >
            <CloseIcon />
          </IconButton>
        </Stack>

        <Box sx={{ height: 80 }} />
      </Stack>
    </Box>
  );
}

export default LinguaSlide; 