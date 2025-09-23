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
        <div className="flex flex-col items-center justify-center p-4 md:p-8 text-center">
            <div className="space-y-4 w-full max-w-sm">
                {hasSavedGame && (
                    <button 
                        onClick={onLoadGame}
                        className="menu-button btn-continue"
                    >
                        <Icons.Play className="h-6 w-6 mr-3"/>
                        Continuar Aventura
                    </button>
                )}
                <button 
                    onClick={handleImportClick}
                    className="menu-button btn-import"
                >
                    <Icons.Upload className="h-6 w-6 mr-3"/>
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
                    className="menu-button btn-new"
                >
                     <Icons.PlusCircle className="h-6 w-6 mr-3"/>
                    Criar Novo Personagem
                </button>
            </div>
        </div>
    );
};

export default CharacterCreationMenu;
