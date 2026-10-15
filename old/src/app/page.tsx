'use client';
import { GameStateProvider } from '@/contexts/GameStateContext';
import GameContainer from '@/components/GameContainer';
import AuthGateV2 from '@/components/Auth/AuthGateV2';

export default function HomePage() {
  return (
    <main className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden">
      <AuthGateV2>
        <GameStateProvider>
          <GameContainer />
        </GameStateProvider>
      </AuthGateV2>
    </main>
  );
}
