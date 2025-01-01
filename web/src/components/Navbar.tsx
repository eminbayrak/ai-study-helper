import { AppBar, IconButton, Toolbar, Typography } from '@mui/material';
import { List, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

interface NavbarProps {
  onMenuClick: () => void;
}

function Navbar({ onMenuClick }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleMenuClick = () => {
    setIsOpen(!isOpen);
    onMenuClick();
  };

  return (
    <AppBar 
      position="fixed"
      className={isScrolled ? 'navbar-blur' : ''}
      sx={{
        background: isScrolled 
          ? 'rgba(15, 23, 42, 0.7)'
          : 'transparent',
        boxShadow: 'none',
        transition: 'all 0.3s ease-in-out',
        borderBottom: isScrolled ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
        '@media (prefers-color-scheme: light)': {
          background: isScrolled 
            ? 'rgba(248, 250, 252, 0.7)'
            : 'transparent',
          borderBottom: isScrolled ? '1px solid rgba(0, 0, 0, 0.1)' : 'none',
        }
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          edge="start"
          onClick={handleMenuClick}
          sx={{ 
            mr: 2,
            '& svg': {
              width: 24,
              height: 24,
              transition: 'transform 0.3s ease'
            }
          }}
        >
          {isOpen ? (
            <X weight="bold" />
          ) : (
            <List weight="bold" />
          )}
        </IconButton>
        <Typography 
          variant="h6" 
          noWrap 
          component="div"
          sx={{ 
            fontWeight: 600,
            letterSpacing: '-0.02em'
          }}
        >
          EduLingo
        </Typography>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar; 