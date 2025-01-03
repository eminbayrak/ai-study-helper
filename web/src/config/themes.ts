export interface Theme {
  id: string;
  name: string;
  colors: {
    bg: string;
    main: string;
    sub: string;
    card: string;
    text: string;
    error: string;
    success: string;
  }
}

export const themes: Theme[] = [
  {
    id: 'serika-dark',
    name: 'Serika Dark',
    colors: {
      bg: '#2c2e31',
      main: '#e2b714',
      sub: '#9fa1a4',
      card: '#323437',
      text: '#e8e8e2',
      error: '#ff4a57',
      success: '#55d45b'
    }
  },
  {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      bg: '#282a36',
      main: '#bd93f9',
      sub: '#a7b4e0',
      card: '#2d303e',
      text: '#f8f8f2',
      error: '#ff5555',
      success: '#50fa7b'
    }
  },
  {
    id: 'monokai',
    name: 'Monokai',
    colors: {
      bg: '#272822',
      main: '#ff5f97',
      sub: '#bbbfb0',
      card: '#2d2e28',
      text: '#f8f8f2',
      error: '#ff3333',
      success: '#b8f346'
    }
  }
]; 