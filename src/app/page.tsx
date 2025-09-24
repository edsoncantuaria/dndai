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
      className="h-full w-full"
    >
      <GameStateProvider key={gameKey}>
        <Game startNewGame={startNewGame} />
      </GameStateProvider>
    </main>
  );
}
