'use client';
import { GameStateProvider, useGameStateContext } from '@/contexts/GameStateContext';
import Game from '@/components/Game';
import { useState, useCallback, useEffect, useRef } from 'react';
import { SettingsProvider, useSettingsContext } from '@/contexts/SettingsContext';

// Define os estágios do jogo para controlar o fluxo da UI
type GameStage = 'menu' | 'creating' | 'created' | 'playing';

// Este componente agora contém a lógica principal da página e pode acessar o contexto.
const HomePageContent = () => {
    const { character, loadGameFromLocalStorage } = useGameStateContext();
    const { playMenuMusic, volume, isMuted } = useSettingsContext();
    const [gameStage, setGameStage] = useState<GameStage>('menu');
    const menuAudioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const audio = menuAudioRef.current;
        if (!audio) return;

        const audioUrl = '/audio/inicio.mp3';

        const playAudio = () => {
            audio.volume = isMuted ? 0 : volume;
            if (audio.paused) {
                audio.play().catch(e => console.error("Menu audio play failed:", e));
            }
        };
        
        if (gameStage === 'menu' && playMenuMusic) {
            // Se a URL do áudio ainda não foi definida ou é diferente, defina-a
            if (audio.src !== window.location.origin + audioUrl) {
                audio.src = audioUrl;
                // Adiciona um ouvinte para garantir que a música só toque quando estiver pronta
                audio.addEventListener('canplaythrough', playAudio);
                audio.load();
            } else {
                // Se o src já estiver correto, apenas toque
                playAudio();
            }
        } else {
            audio.pause();
            audio.currentTime = 0;
        }

        // Função de limpeza para remover o ouvinte de eventos
        return () => {
            audio.removeEventListener('canplaythrough', playAudio);
        };

    }, [gameStage, playMenuMusic, volume, isMuted]);


    // Função para limpar o jogo salvo e ir para a tela de criação
    const startNewGameFlow = useCallback(() => {
        // A lógica de reset agora está dentro do próprio hook, 
        // mas a UI controla a mudança de estágio.
        setGameStage('creating');
    }, []);

    // Função chamada pelo componente de criação quando o personagem está pronto
    const onCharacterCreated = useCallback(() => {
        // Agora, em vez de iniciar o jogo, apenas mudamos para a tela de confirmação.
        setGameStage('created');
    }, []);
    
    // Função para finalmente entrar no jogo e fazer a primeira chamada à IA
    const onPlay = useCallback(() => {
        setGameStage('playing');
        // A chamada `startGame` será acionada pelo `useEffect` no Game.tsx
        // quando o gameStage for 'playing'.
    }, []);
    
    const onContinueGame = useCallback(() => {
        loadGameFromLocalStorage();
        setGameStage('playing');
    }, [loadGameFromLocalStorage]);


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
        <>
            <audio ref={menuAudioRef} loop />
            <Game
                startNewGameFlow={startNewGameFlow}
                onCharacterCreated={onCharacterCreated}
                onContinueGame={onContinueGame}
                gameStage={gameStage}
            />
        </>
    );
};

// O componente principal agora envolve tudo com os Providers.
export default function HomePage() {
  return (
    <main
      className="h-full w-full bg-gradient-to-br from-black via-stone-900 to-red-950 p-2 md:p-4 flex items-center justify-center"
    >
        <SettingsProvider>
            <GameStateProvider>
                <HomePageContent />
            </GameStateProvider>
        </SettingsProvider>
    </main>
  );
}
