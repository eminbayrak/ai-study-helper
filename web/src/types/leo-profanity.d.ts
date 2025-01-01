declare module 'leo-profanity' {
  const profanity: {
    loadDictionary: (lang: string) => void;
    add: (words: string[]) => void;
    remove: (words: string[]) => void;
    check: (text: string) => boolean;
    clean: (text: string) => string;
  };
  export default profanity;
} 