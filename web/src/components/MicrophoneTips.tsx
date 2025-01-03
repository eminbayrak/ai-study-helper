import { useTheme } from '../contexts/ThemeContext';

export const MicrophoneTips = () => {
    const { currentTheme } = useTheme();

    return (
        <div className="flex flex-col items-center justify-center text-center h-[calc(100vh-200px)] max-w-md mx-auto">
            <h3 
                className="text-lg font-semibold mb-4"
                style={{ color: currentTheme.colors.main }}
            >
                🎤 For Best Results
            </h3>
            <ul 
                className="space-y-2"
                style={{ color: currentTheme.colors.text }}
            >
                <li>Position microphone close to mouth (4-6 inches)</li>
                <li>Speak clearly at a normal pace</li>
                <li>Minimize background noise</li>
                <li>Pronounce words naturally</li>
            </ul>
        </div>
    );
}; 