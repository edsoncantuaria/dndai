'use client';
import { GameStateProvider } from '@/contexts/GameStateContext';
import Game from './_components/Game';
import { useState, useCallback } from 'react';

export default function HomePage() {
  // A key is used to force re-mounting of the GameStateProvider and all its children,
  // effectively resetting the entire game state.
  const [gameKey, setGameKey] = useState(0);

  const startNewGame = useCallback(() => {
    localStorage.removeItem('rpg-de-cria-savegame');
    setGameKey(prevKey => prevKey + 1);
  }, []);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/background.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <GameStateProvider key={gameKey}>
        <Game startNewGame={startNewGame} />
      </GameStateProvider>
    </main>
  );
}
