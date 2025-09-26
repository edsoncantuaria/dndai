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

        const shouldPlay = playMenuMusic && (gameStage === 'menu' || gameStage === 'creating' || gameStage === 'created');

        if (shouldPlay) {
            // Garante que o src está correto antes de tocar
            const audioUrl = '/audios/index/inicio.mp3';
            if (!audio.src || !audio.src.endsWith(audioUrl)) {
                audio.src = audioUrl;
            }
            audio.loop = true;
            audio.volume = isMuted ? 0 : volume;
            audio.play().catch(e => console.error("Menu audio play failed:", e));
        } else {
            audio.pause();
        }
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
            <audio ref={menuAudioRef} />
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
