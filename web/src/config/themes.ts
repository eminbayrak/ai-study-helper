export interface Theme {
  id: string;
  name: string;
  colors: {
    bg: string;
    main: string;
    caret: string;
    sub: string;
    text: string;
    error: string;
    success: string;
    colorfulError: string;
    colorfulSuccess: string;
  };
}

export const themes: Theme[] = [
  {
    id: 'serika-dark',
    name: 'Serika Dark',
    colors: {
      bg: '#323437',
      main: '#e2b714',
      caret: '#e2b714',
      sub: '#646669',
      text: '#d1d0c5',
      error: '#ca4754',
      success: '#4CAF50',
      colorfulError: '#ca4754',
      colorfulSuccess: '#4CAF50'
    }
  },
  {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      bg: '#282a36',
      main: '#bd93f9',
      caret: '#f8f8f2',
      sub: '#6272a4',
      text: '#f8f8f2',
      error: '#ff5555',
      success: '#50fa7b',
      colorfulError: '#ff5555',
      colorfulSuccess: '#50fa7b'
    }
  },
  {
    id: 'monokai',
    name: 'Monokai',
    colors: {
      bg: '#272822',
      main: '#f92672',
      caret: '#f8f8f2',
      sub: '#75715e',
      text: '#f8f8f2',
      error: '#f92672',
      success: '#a6e22e',
      colorfulError: '#f92672',
      colorfulSuccess: '#a6e22e'
    }
  }
]; 