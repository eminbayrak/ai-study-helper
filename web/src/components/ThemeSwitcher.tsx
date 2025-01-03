import { Button } from "./ui/button";
import { Palette } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useTheme } from "../contexts/ThemeContext";

export default function ThemeSwitcher() {
  const { currentTheme, setTheme, themes } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
        >
          <Palette className="h-4 w-4" />
          <div 
            className="absolute w-2 h-2 rounded-full right-2 bottom-2"
            style={{ backgroundColor: currentTheme.colors.main }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[200px]"
        style={{
          backgroundColor: currentTheme.colors.bg,
          borderColor: currentTheme.colors.sub,
        }}
      >
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            className="flex items-center gap-2"
            style={{
              backgroundColor: currentTheme.id === theme.id ? theme.colors.bg : 'transparent',
              color: currentTheme.colors.text,
              ':hover': {
                backgroundColor: theme.colors.sub,
              },
            }}
          >
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: theme.colors.main }}
            />
            <span>{theme.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 