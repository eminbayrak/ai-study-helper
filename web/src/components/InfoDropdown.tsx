import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Info } from 'lucide-react';

export const InfoDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { currentTheme } = useTheme();
    const dropdownRef = useRef<HTMLDivElement>(null);

    const iconButtonStyle = {
        color: currentTheme.colors.text,
        '&:hover': {
            backgroundColor: currentTheme.colors.sub,
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <Button 
                variant="ghost" 
                size="icon" 
                className="w-9 h-9"
                style={iconButtonStyle}
                onClick={() => setIsOpen(!isOpen)}
            >
                <Info className="h-4 w-4" />
            </Button>

            {isOpen && (
                <div 
                    className="absolute left-1/2 mt-2 w-72 rounded-md shadow-lg z-50"
                    style={{ 
                        backgroundColor: currentTheme.colors.card,
                        border: `1px solid ${currentTheme.colors.sub}`,
                        transform: 'translateX(-50%)',
                    }}
                >
                    <div className="p-4 text-center">
                        <h3 
                            className="text-lg font-semibold mb-3"
                            style={{ color: currentTheme.colors.main }}
                        >
                            About LingoSlide
                        </h3>
                        <div style={{ color: currentTheme.colors.text }}>
                            <p className="mb-3">
                                LingoSlide is a pronunciation practice app that helps you improve your speaking skills.
                            </p>
                            <ul className="list-none space-y-2">
                                <li>Practice word pronunciation</li>
                                <li>Get instant feedback</li>
                                <li>Track your progress</li>
                                <li>Multiple difficulty levels</li>
                            </ul>
                            <div className="mt-4 pt-3 border-t" style={{ borderColor: currentTheme.colors.sub }}>
                                <p className="text-sm">
                                    🎤 Tip: Position your microphone 4-6 inches from your mouth for best results
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}; 