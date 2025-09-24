'use client';
import { GameStateProvider } from '@/contexts/GameStateContext';
import Game from './_components/Game';
import { useState, useCallback } from 'react';

export default function HomePage() {
  const [gameKey, setGameKey] = useState(0);

  const startNewGame = useCallback(() => {
    localStorage.removeItem('rpg-de-cria-savegame');
    setGameKey(prevKey => prevKey + 1);
  }, []);

  return (
    <main
      className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-black via-stone-900 to-red-950 p-2 md:p-4"
    >
      <GameStateProvider key={gameKey}>
        <Game startNewGame={startNewGame} />
      </GameStateProvider>
    </main>
  );
}
