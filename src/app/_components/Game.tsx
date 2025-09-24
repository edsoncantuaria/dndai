'use client';

import React from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import CharacterCreation from '@/components/CharacterCreation';
import GameScreen from '@/components/GameScreen';

export default function Game({ startNewGame }: { startNewGame: () => void }) {
    const gameStateHook = useGameStateContext();

    return (
      <div className="h-full w-full bg-gradient-to-br from-black via-stone-900 to-red-950 p-2 md:p-4">
        {gameStateHook.character ? (
          <GameScreen />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center">
              <CharacterCreation startNewGame={startNewGame} />
          </div>
        )}
      </div>
    );
};
