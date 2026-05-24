'use client';
import { GameStateProvider } from '@/contexts/GameStateContext';
import GameContainer from '@/components/GameContainer';
import AuthGate from '@/components/Auth/AuthGate';
import AuthGateV2 from '@/components/Auth/AuthGateV2';
import { isUiV2Enabled } from '@/lib/uiV2';

export default function HomePage() {
  const Gate = isUiV2Enabled() ? AuthGateV2 : AuthGate;

  return (
    <main
      className={
        isUiV2Enabled()
          ? 'h-full w-full'
          : 'h-full w-full p-2 md:p-4 flex flex-col items-center justify-start md:justify-center'
      }
    >
      <Gate>
        <GameStateProvider>
          <GameContainer />
        </GameStateProvider>
      </Gate>
    </main>
  );
}
