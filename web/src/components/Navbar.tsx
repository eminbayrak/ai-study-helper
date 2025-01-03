import { Button } from "./ui/button";
import { Settings, Crown, Info, Bell, User } from "lucide-react";
import { cn } from "../lib/utils";

interface NavbarProps {
  onMenuClick?: () => void;
}

function Navbar({ onMenuClick }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 h-12 flex items-center justify-between px-4 bg-background/50 backdrop-blur-sm border-b border-border/40 z-50">
      <div className="flex items-center space-x-4">
        {/* Logo */}
        <div className="text-lg font-semibold tracking-tight">
          lingua<span className="text-primary">slide</span>
        </div>
        
        {/* Left side icons */}
        <div className="hidden md:flex items-center space-x-1">
          <Button variant="ghost" size="icon" className="w-9 h-9">
            <Crown className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="w-9 h-9">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Right side icons */}
      <div className="flex items-center space-x-1">
        <Button variant="ghost" size="icon" className="w-9 h-9">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-9 h-9">
          <Settings className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="w-9 h-9">
          <User className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

export default Navbar; 