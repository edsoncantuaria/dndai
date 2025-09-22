'use client';

import React from 'react';
import { useGameState } from '@/hooks/useGameState';
import CharacterCreation from '@/components/CharacterCreation';
import GameScreen from '@/components/GameScreen';

const Game: React.FC = () => {
    const gameStateHook = useGameState();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleLoadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            gameStateHook.loadGameFromFile(file);
        }
    };

    return (
        <div className="min-h-screen bg-transparent text-stone-200 font-sans p-4 sm:p-6 lg:p-8 flex flex-col animate-fadeIn">
            <div className="w-full max-w-screen-2xl mx-auto flex flex-col flex-grow">
                <header className="flex-shrink-0 flex justify-between items-center flex-wrap gap-4 bg-black/10 p-4 rounded-lg">
                    <h1 className="text-4xl font-bold font-garamond text-amber-400 text-center text-shadow-amber shadow-lg">RPG de Cria</h1>
                    {gameStateHook.character && (
                        <div className="flex items-center gap-2">
                            <button onClick={gameStateHook.startNewGame} className="bg-red-800 hover:bg-red-700 text-stone-200 font-semibold py-1 px-3 rounded-md text-sm transition-colors">
                                Novo Jogo
                            </button>
                            <button onClick={gameStateHook.saveGameToFile} className="bg-stone-700 hover:bg-stone-600 text-stone-200 font-semibold py-1 px-3 rounded-md text-sm transition-colors">
                                Exportar Jogo
                            </button>
                            <button onClick={handleLoadClick} className="bg-stone-700 hover:bg-stone-600 text-stone-200 font-semibold py-1 px-3 rounded-md text-sm transition-colors">
                                Importar Jogo
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".json"
                                className="hidden"
                            />
                        </div>
                    )}
                </header>
                <main className="w-full flex-grow flex flex-col overflow-y-auto mt-6">
                    {!gameStateHook.character ? <CharacterCreation /> : <GameScreen />}
                </main>
            </div>
        </div>
    );
};
