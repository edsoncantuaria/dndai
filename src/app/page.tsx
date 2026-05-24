'use client';
import { GameStateProvider } from '@/contexts/GameStateContext';
import GameContainer from '@/components/GameContainer';
import AuthGate from '@/components/Auth/AuthGate';

export default function HomePage() {
  return (
    <main className="h-full w-full p-2 md:p-4 flex flex-col items-center justify-start md:justify-center">
      <AuthGate>
        <GameStateProvider>
          <GameContainer />
        </GameStateProvider>
      </AuthGate>
    </main>
  );
}
