'use client';
import { GameStateProvider } from '@/contexts/GameStateContext';
import Game from '@/components/Game';
import { useState, useCallback } from 'react';

// Define os estágios do jogo para controlar o fluxo da UI
type GameStage = 'menu' | 'creating' | 'created' | 'playing';

export default function HomePage() {
  const [gameKey, setGameKey] = useState(0);
  // O estado 'gameStage' agora controla qual componente principal é exibido.
  const [gameStage, setGameStage] = useState<GameStage>('menu');

  // Função para limpar o jogo salvo e ir para a tela de criação
  const startNewGameFlow = useCallback(() => {
    localStorage.removeItem('rpg-de-cria-savegame-v2');
    setGameKey(prevKey => prevKey + 1);
    setGameStage('creating');
  }, []);

  // Função chamada pelo componente de criação quando o personagem está pronto
  const onCharacterCreated = useCallback(() => {
    setGameStage('created');
  }, []);

  // Função para finalmente entrar no jogo
  const onPlay = useCallback(() => {
    setGameStage('playing');
  }, []);

  const renderContent = () => {
    // No estágio 'created', mostramos uma tela intermediária com o botão "Continuar".
    if (gameStage === 'created') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-3xl font-bold text-amber-300 font-garamond animate-fadeIn">Personagem Criado!</h2>
            <p className="text-stone-400 mt-2 animate-fadeIn" style={{ animationDelay: '200ms' }}>Seu herói está pronto para a aventura.</p>
            <button
                onClick={onPlay}
                className="menu-button btn-new mt-8 animate-fadeIn"
                style={{ animationDelay: '400ms' }}
            >
                Continuar
            </button>
        </div>
      );
    }

    // Renderiza o componente Game, que internamente decide se mostra
    // o menu/criação ou a tela de jogo principal.
    return (
       <Game
          startNewGameFlow={startNewGameFlow}
          onCharacterCreated={onCharacterCreated}
          gameStage={gameStage}
        />
    );
  };

  return (
    <main
      className="h-full w-full bg-gradient-to-br from-black via-stone-900 to-red-950 p-2 md:p-4 flex items-center justify-center"
    >
      <GameStateProvider key={gameKey}>
        {renderContent()}
      </GameStateProvider>
    </main>
  );
}
