import { AppBar, IconButton, Toolbar, Typography } from '@mui/material';
import { List, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

interface NavbarProps {
  onMenuClick: () => void;
}

function Navbar({ onMenuClick }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleMenuClick = () => {
    setIsOpen(!isOpen);
    onMenuClick();
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AppBar 
      position="fixed"
      sx={{
        background: isScrolled 
          ? 'rgba(36, 36, 36, 0.8)'
          : 'transparent',
        backdropFilter: isScrolled ? 'blur(10px)' : 'none',
        boxShadow: isScrolled ? '0 4px 30px rgba(0, 0, 0, 0.1)' : 'none',
        transition: 'all 0.3s ease-in-out',
        '&.MuiAppBar-root': {
          backgroundImage: 'none',
        },
        '@media (prefers-color-scheme: light)': {
          background: isScrolled 
            ? 'rgba(255, 255, 255, 0.8)'
            : 'transparent',
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