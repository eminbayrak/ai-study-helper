// Remove or comment out all these unused imports
/*
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SchoolIcon from '@mui/icons-material/School';
import { useNavigate } from 'react-router-dom';
*/

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function Sidebar({ open, onClose }: SidebarProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div 
        className="fixed left-0 top-0 h-full w-64 bg-[#323437] p-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar content */}
      </div>
    </div>
  );
}

export default Sidebar; 