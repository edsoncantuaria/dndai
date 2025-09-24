'use client';

import React, { useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import CharacterCreation from '@/components/CharacterCreation';
import GameScreen from '@/components/GameScreen';

export default function Game({ startNewGame }: { startNewGame: () => void }) {
    const gameStateHook = useGameStateContext();

    useEffect(() => {
        // Se um personagem existe mas o log está vazio, significa que um novo jogo acabou de começar.
        // Esta é a deixa para buscar a narrativa inicial da IA.
        if (gameStateHook.character && gameStateHook.log.length === 0 && !gameStateHook.isLoading) {
            gameStateHook.startGame();
        }
    }, [gameStateHook.character, gameStateHook.log.length, gameStateHook.isLoading, gameStateHook.startGame]);


    return (
      <div className="h-full w-full bg-gradient-to-br from-black via-stone-900 to-red-950 p-2 md:p-4 flex items-center justify-center">
        {gameStateHook.character ? (
          <GameScreen />
        ) : (
            <CharacterCreation startNewGame={startNewGame} />
        )}
      </div>
    );
};
