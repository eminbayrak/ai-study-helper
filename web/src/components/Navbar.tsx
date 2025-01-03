import { Button } from "./ui/button";
import { Settings, Crown, Info, Bell, User } from "lucide-react";
import { cn } from "../lib/utils";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useTheme } from "../contexts/ThemeContext";

interface NavbarProps {
  onMenuClick?: () => void;
}

function Navbar({ onMenuClick }: NavbarProps) {
  const { currentTheme } = useTheme();

  return (
    <nav className="fixed top-0 left-0 right-0 h-12 flex items-center justify-between px-4 bg-transparent backdrop-blur-md z-50 border-b border-[#2c2c2c]/50">
      <div className="flex items-center space-x-4">
        {/* Logo */}
        <div className="text-lg font-custom font-light tracking-wider">
          edu<span style={{ color: currentTheme.colors.main }}>lingo</span>
        </div>
        
        {/* Left side icons */}
        <div className="hidden md:flex items-center space-x-1">
          <Button variant="ghost" size="icon" className="w-9 h-9 hover:bg-[#2c2c2c]">
            <Crown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-9 h-9 hover:bg-[#2c2c2c]">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Right side icons */}
      <div className="flex items-center space-x-1">
        <ThemeSwitcher />
        <Button variant="ghost" size="icon" className="w-9 h-9 hover:bg-[#2c2c2c]">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-9 h-9 hover:bg-[#2c2c2c]">
          <Settings className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-9 h-9 hover:bg-[#2c2c2c]">
          <User className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

export default Navbar; 