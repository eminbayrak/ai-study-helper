import { useEffect, useState, useRef } from 'react';
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import {
  Mic,
  MicOff,
  SkipForward,
  RefreshCw,
  Volume2,
  X,
  Play,
  Star
} from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "../components/ui/toggle-group";
import { cn } from "../lib/utils";

// Assets
const successSound = 'https://assets.mixkit.co/active_storage/sfx/2018/success-1-6297.wav';
const failureSound = 'https://assets.mixkit.co/active_storage/sfx/2018/failure-drum-sound-effect-2-7184.wav';

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

// Add these helper functions at the top of your file
const isMobileBrowser = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const isSpeechRecognitionSupported = () => {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
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
  const [lastSpokenTimestamp, setLastSpokenTimestamp] = useState<number>(Date.now());
  const [showInactiveWarning, setShowInactiveWarning] = useState(false);
  const [hasSpokenOnce, setHasSpokenOnce] = useState(false);
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

  // Ready State UI
  if (gameState === 'ready') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 -mt-32 bg-[#323437] text-[#d1d0c5] font-custom">
        <div className="w-full max-w-2xl space-y-12">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-light tracking-wider">
              lingua<span className="text-[#e2b714]">slide</span>
            </h1>
            <div className="inline-flex items-center px-2 py-1 rounded bg-[#2c2c2c] text-[#646669] text-xs font-medium">
              BETA
            </div>
          </div>

          {/* Device Warning */}
          {isMobileBrowser() && (
            <div className="bg-[#2c2c2c] p-4 rounded text-sm text-[#e2b714]">
              For the best experience, please use a desktop browser with Chrome.
            </div>
          )}

          {/* Difficulty Selection */}
          <div className="space-y-8">
            <h2 className="text-lg font-light text-center text-[#646669]">
              Select Difficulty
            </h2>

            <ToggleGroup
              type="single"
              value={difficulty}
              onValueChange={(value) => value && setDifficulty(value as Difficulty)}
              className="justify-center"
            >
              <ToggleGroupItem value="easy" className="data-[state=on]:bg-[#e2b714] data-[state=on]:text-[#323437]">Easy</ToggleGroupItem>
              <ToggleGroupItem value="medium" className="data-[state=on]:bg-[#e2b714] data-[state=on]:text-[#323437]">Medium</ToggleGroupItem>
              <ToggleGroupItem value="hard" className="data-[state=on]:bg-[#e2b714] data-[state=on]:text-[#323437]">Hard</ToggleGroupItem>
            </ToggleGroup>

            {/* Best Practices */}
            <div className="bg-[#2c2c2c] p-4 rounded">
              <h3 className="font-medium text-[#e2b714] mb-2">📢 For Best Results</h3>
              <ul className="text-sm text-[#646669] space-y-1">
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
                className="w-24 h-24 rounded-full bg-[#e2b714] hover:bg-[#e2b714]/90 text-[#323437]"
                onClick={startGame}
                disabled={isStarting}
              >
                {isStarting ? (
                  <RefreshCw className="h-8 w-8 animate-spin" />
                ) : (
                  <Play className="h-8 w-8" />
                )}
              </Button>

              <p className="text-sm text-[#646669]">
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
      <div className="min-h-screen flex flex-col p-4 pt-8 bg-[#323437] text-[#d1d0c5] font-custom">
        {/* Timer and Progress */}
        <div className="w-full max-w-2xl mx-auto mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className={cn(
              "text-2xl font-light text-[#646669]",
              timeLeft <= 10 && "text-[#e2b714]"
            )}>
              {timeLeft}s
            </span>
            <span className="text-sm font-light text-[#646669]">
              {progress}%
            </span>
          </div>
          <Progress 
            value={progress} 
            className="h-0.5 bg-[#2c2c2c]" 
          />
        </div>

        {/* Word List */}
        <div className="w-full max-w-2xl mx-auto flex-1 space-y-1">
          {wordList.map((item, index) => (
            <div
              key={index}
              id={`word-${index}`}
              className={cn(
                "p-3 rounded transition-all flex items-center",
                item.unlocked && !item.completed && "bg-[#2c2c2c]",
                !item.unlocked && "opacity-40",
                item.completed && !item.hadIncorrectAttempt && !item.skipped && "text-[#4CAF50]",
                (item.hadIncorrectAttempt || item.skipped) && "text-[#e2b714]"
              )}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 hover:bg-[#3a3a3a] text-[#646669] hover:text-[#d1d0c5] mr-2"
                onClick={() => speak(item.word)}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-light tracking-wide">{item.word}</span>
                  <span className="text-sm font-light text-[#646669] tracking-wider">
                    {item.phonetic}
                  </span>
                </div>
              </div>

              {item.completed && (
                item.skipped ? (
                  <X className="h-4 w-4 text-[#e2b714] ml-2" />
                ) : (
                  <Star className="h-4 w-4 text-[#4CAF50] ml-2" />
                )
              )}
            </div>
          ))}
        </div>

        {/* Control Buttons */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#323437]/90 backdrop-blur-sm border-t border-[#2c2c2c]">
          <div className="flex justify-center gap-2 max-w-2xl mx-auto">
            <Button
              size="lg"
              variant="ghost"
              className={cn(
                "h-12 w-12 rounded hover:bg-[#2c2c2c] border border-[#2c2c2c]",
                isListening && "bg-[#2c2c2c] text-[#e2b714]"
              )}
              onClick={toggleListening}
            >
              {isListening ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
            </Button>

            <Button
              size="lg"
              variant="ghost"
              className="h-12 w-12 rounded hover:bg-[#2c2c2c] border border-[#2c2c2c]"
              onClick={handleSkip}
              disabled={gameState !== 'playing'}
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              size="lg"
              variant="ghost"
              className="h-12 w-12 rounded hover:bg-[#2c2c2c] border border-[#2c2c2c]"
              onClick={fetchWords}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <Button
              size="lg"
              variant="ghost"
              className="h-12 w-12 rounded hover:bg-[#2c2c2c] border border-[#2c2c2c] text-[#f44336]"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Results State UI
  if (gameState === 'finished' && gameResult) {
    return (
      <div className="min-h-screen flex flex-col items-center p-4 -mt-12 bg-[#323437] text-[#d1d0c5] font-custom">
        <div className="w-full max-w-2xl flex flex-col min-h-screen">
          {/* Header - Reduced top padding */}
          <div className="pt-4 pb-6">
            <h2 className="text-4xl font-light text-center tracking-wider">Practice Summary</h2>
          </div>

          {/* Content - with max height and reduced spacing */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {wordList.some(w => w.skipped || w.hadIncorrectAttempt) ? (
              <>
                <h3 className="text-xl font-light text-[#646669] mb-3">Words to Practice:</h3>
                {/* Scrollable container */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
                  <div className="space-y-1">
                    {wordList
                      .filter(w => w.skipped || w.hadIncorrectAttempt)
                      .map((word, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded bg-[#2c2c2c]"
                        >
                          <div className="flex items-center space-x-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 shrink-0 hover:bg-[#3a3a3a] text-[#646669] hover:text-[#d1d0c5]"
                              onClick={() => speak(word.word)}
                            >
                              <Volume2 className="h-4 w-4" />
                            </Button>
                            <span className="text-xl font-light tracking-wide">{word.word}</span>
                            {word.skipped && (
                              <span className="text-sm font-light text-[#646669] italic tracking-wider">
                                (skipped)
                              </span>
                            )}
                            {!word.skipped && word.spokenWord && (
                              <span className="text-sm font-light text-[#646669] italic tracking-wider truncate">
                                (you said: {word.spokenWord})
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-light text-[#646669] shrink-0 ml-2">
                            {word.attempts} {word.attempts === 1 ? 'attempt' : 'attempts'}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center -mt-20">
                <div className="text-center space-y-6">
                  <Star className="h-24 w-24 text-[#e2b714] mx-auto" />
                  <div className="space-y-2">
                    <h3 className="text-2xl font-light">Perfect Pronunciation!</h3>
                    <p className="text-[#646669]">
                      Amazing job! You nailed every word.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Always visible with reduced padding */}
          <div className="sticky bottom-0 pt-3 pb-2 bg-[#323437]">
            <Button
              size="lg"
              onClick={() => {
                setGameState('ready');
                setGameResult(null);
              }}
              className="w-full h-12 bg-[#e2b714] hover:bg-[#e2b714]/90 text-[#323437] font-light tracking-wider"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default LinguaSlide; 