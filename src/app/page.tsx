'use client';
import { GameStateProvider } from '@/contexts/GameStateContext';
import Game from './_components/Game';
import { useState, useCallback } from 'react';

export default function HomePage() {
  const [gameKey, setGameKey] = useState(0);

  const startNewGame = useCallback(() => {
    // This correctly clears the old game state from local storage.
    localStorage.removeItem('rpg-de-cria-savegame');
    // Incrementing the key forces React to re-mount the GameStateProvider and its children,
    // effectively resetting the entire game state.
    setGameKey(prevKey => prevKey + 1);
  }, []);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-black via-stone-900 to-red-950 p-4"
    >
      <GameStateProvider key={gameKey}>
        <Game startNewGame={startNewGame} />
      </GameStateProvider>
    </main>
  );
}
