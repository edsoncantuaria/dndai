
'use client';

import React, { useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import CharacterCreation from '@/components/CharacterCreation';
import GameScreen from '@/components/GameScreen';
import { Loader2 } from 'lucide-react';

export type GameStage = 'menu' | 'creating' | 'created' | 'playing' | 'loading';

interface GameProps {
  startNewGameFlow: () => void;
  onCharacterCreated: () => void;
  returnToMenu: () => void;
  gameStage: GameStage;
}

export default function Game({ startNewGameFlow, onCharacterCreated, returnToMenu, gameStage }: GameProps) {
    const gameStateHook = useGameStateContext();

    // If the character exists and we are in the 'playing' stage
    if (gameStateHook.character && gameStage === 'playing') {
        // If the initial narration hasn't arrived yet (log is empty), show a loader.
        if (gameStateHook.log.length === 0 && gameStateHook.isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center text-stone-300">
                    <Loader2 className="h-12 w-12 animate-spin mb-4" />
                    <h2 className="text-2xl font-bold font-garamond text-amber-300">Aguarde...</h2>
                    <p className="mt-2">O Mestre de Jogo está preparando sua aventura.</p>
                </div>
            )
        }
        return <GameScreen returnToMenu={returnToMenu} />;
    }

    // Otherwise, show the menu/creation screen.
    return (
        <CharacterCreation 
            startNewGameFlow={startNewGameFlow}
            onCharacterCreated={onCharacterCreated} 
            isCreating={gameStage === 'creating'}
        />
    );
};
