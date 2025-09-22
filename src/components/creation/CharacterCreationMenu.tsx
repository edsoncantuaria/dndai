import React, { useRef } from 'react';
import { Icons } from '../Icons';

interface CharacterCreationMenuProps {
    hasSavedGame: boolean;
    onNewGame: () => void;
    onLoadGame: () => void;
    onImportFile: (file: File) => void;
}

const CharacterCreationMenu: React.FC<CharacterCreationMenuProps> = ({ hasSavedGame, onNewGame, onLoadGame, onImportFile }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onImportFile(file);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-stone-800/50 rounded-lg border border-stone-700 animate-fadeIn">
            <h2 className="text-3xl font-bold font-garamond text-amber-300 mb-8 text-shadow-amber">Boas-vindas, aventureiro!</h2>
            <div className="space-y-4 w-full max-w-sm">
                {hasSavedGame && (
                    <button 
                        onClick={onLoadGame}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-stone-100 font-bold py-3 px-6 rounded-md transition-colors text-lg sm:text-xl flex items-center justify-center gap-3"
                    >
                        <Icons.Play className="h-6 w-6"/>
                        Continuar Última Aventura
                    </button>
                )}
                <button 
                    onClick={handleImportClick}
                    className="w-full bg-stone-700 hover:bg-stone-600 text-stone-200 font-bold py-3 px-6 rounded-md transition-colors text-lg sm:text-xl flex items-center justify-center gap-3"
                >
                    <Icons.Upload className="h-6 w-6"/>
                    Importar Aventura
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json"
                    className="hidden"
                />
                <button 
                    onClick={onNewGame}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-stone-900 font-bold py-3 px-6 rounded-md transition-colors text-lg sm:text-xl flex items-center justify-center gap-3"
                >
                    <Icons.PlusCircle className="h-6 w-6"/>
                    Criar Novo Personagem
                </button>
            </div>
        </div>
    );
};

export default CharacterCreationMenu;
