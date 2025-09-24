'use client';

import React from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import CharacterCreation from '@/components/CharacterCreation';
import GameScreen from '@/components/GameScreen';

export default function Game({ startNewGame }: { startNewGame: () => void }) {
    const gameStateHook = useGameStateContext();

    if (gameStateHook.character) {
        return <GameScreen />;
    }

    return (
        <div className="flex h-full w-full flex-col items-center justify-center p-2 md:p-4">
            <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center text-center">
                 <header className="mb-12 animate-fadeIn" style={{ animationDelay: '200ms' }}>
                    <h1 
                      className="text-5xl md:text-7xl font-bold text-amber-50"
                      style={{ textShadow: '0 0 15px rgba(239, 68, 68, 0.4), 0 0 5px rgba(239, 68, 68, 0.6)' }}
                    >
                        Crônicas de Aventuras
                    </h1>
                    <p className="text-stone-400 mt-2 text-lg">Um RPG de texto gerado por IA</p>
                </header>
                <main className="w-full animate-fadeIn" style={{ animationDelay: '400ms' }}>
                    <CharacterCreation startNewGame={startNewGame} />
                </main>
            </div>
        </div>
    );
};
