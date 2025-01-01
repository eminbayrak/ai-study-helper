import React, { useState, useEffect, useRef } from 'react';
import { IconButton } from '@mui/material';
import { Microphone, MicrophoneSlash } from '@phosphor-icons/react';

interface SpeechRecognition extends EventTarget {
  start(): void;
  stop(): void;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  continuous: boolean;
  interimResults: boolean;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const LinguaSlide: React.FC = () => {
  const [isMicActive, setIsMicActive] = useState(true);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [gameState, setGameState] = useState<string>('playing');
  const [isInitialized, setIsInitialized] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isStartedRef = useRef(false);

  // Initialize recognition once
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const newRecognition = new SpeechRecognition();
      newRecognition.continuous = false;
      newRecognition.interimResults = true;
      
      newRecognition.onend = () => {
        isStartedRef.current = false;
        if (isMicActive && gameState === 'playing') {
          try {
            newRecognition.start();
            isStartedRef.current = true;
          } catch (error) {
            console.error('Failed to restart recognition:', error);
          }
        }
      };

      recognitionRef.current = newRecognition;
      setRecognition(newRecognition);
      setIsInitialized(true);
    }
  }, []);

  const handleMicToggle = () => {
    const currentRecognition = recognitionRef.current;
    if (!currentRecognition) return;

    const newMicState = !isMicActive;
    setIsMicActive(newMicState);
    
    if (!newMicState) {
      setGameState('stopped');
      currentRecognition.stop();
      isStartedRef.current = false;
    } else {
      setGameState('playing');
      try {
        currentRecognition.start();
        isStartedRef.current = true;
      } catch (error) {
        console.error('Failed to start recognition:', error);
      }
    }
  };

  return (
    <IconButton onClick={handleMicToggle}>
      {!isMicActive ? <MicrophoneSlash weight="bold" /> : <Microphone weight="bold" />}
    </IconButton>
  );
};

export default LinguaSlide; 