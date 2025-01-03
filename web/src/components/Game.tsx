import { MicrophoneTips } from './MicrophoneTips';

export const Game = () => {
    const handleTryAgain = () => {
        window.location.reload(); // This will refresh the page
    };

    return (
        <div className="flex flex-col items-center min-h-screen">
            <div className="flex-1 flex flex-col items-center justify-center">
                <MicrophoneTips />
                {/* Other game components */}
                <div className="text-center mb-20">
                    <div className="mb-4">
                        <h1>Practice Summary</h1>
                        <p>Amazing job! You nailed every word.</p>
                    </div>
                    <button 
                        onClick={handleTryAgain}
                        className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 rounded-md"
                    >
                        ↺ Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}; 