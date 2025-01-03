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
      bg: '#323437',
      main: '#e2b714',
      sub: '#646669',
      card: '#323437',
      text: '#d1d0c5',
      error: '#ca4754',
      success: '#4CAF50'
    }
  },
  {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      bg: '#282a36',
      main: '#bd93f9',
      sub: '#6272a4',
      card: '#282a36',
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
      main: '#f92672',
      sub: '#75715e',
      card: '#272822',
      text: '#f8f8f2',
      error: '#f92672',
      success: '#a6e22e'
    }
  }
]; 