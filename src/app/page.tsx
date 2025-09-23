import { GameStateProvider } from '@/contexts/GameStateContext';
import Game from './_components/Game';

export default function HomePage() {
  return (
    <GameStateProvider>
      <main
        className="flex min-h-screen flex-col items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <Game />
      </main>
    </GameStateProvider>
  );
}