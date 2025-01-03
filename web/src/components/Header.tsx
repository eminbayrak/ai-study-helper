import { InfoDropdown } from './InfoDropdown';

export const Header = () => {
    return (
        <header className="flex justify-between items-center p-4">
            <div className="flex-1">
                {/* Other header content */}
            </div>
            <div className="flex items-center gap-2">
                <InfoDropdown />
                {/* Other header items */}
            </div>
        </header>
    );
}; 