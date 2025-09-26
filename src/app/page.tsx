'use client';
import { GameStateProvider, useGameStateContext } from '@/contexts/GameStateContext';
import Game from '@/components/Game';
import { useState, useCallback, useEffect, useRef } from 'react';
import { SettingsProvider, useSettingsContext } from '@/contexts/SettingsContext';
import Head from 'next/head';

// Define os estágios do jogo para controlar o fluxo da UI
type GameStage = 'menu' | 'creating' | 'created' | 'playing';

// Este componente agora contém a lógica principal da página e pode acessar o contexto.
const HomePageContent = () => {
    const { character, loadGameFromLocalStorage } = useGameStateContext();
    const { playMenuMusic, volume, isMuted } = useSettingsContext();
    const [gameStage, setGameStage] = useState<GameStage>('menu');
    const menuAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Create audio element programmatically to ensure it's available
        if (!menuAudioRef.current) {
            menuAudioRef.current = new Audio();
        }
        const audio = menuAudioRef.current;

        const shouldPlay = playMenuMusic && (gameStage === 'menu' || gameStage === 'creating' || gameStage === 'created');

        if (shouldPlay) {
            // Only change src if it's not already set to the correct one
            if (audio.src !== window.location.origin + '/audios/index/inicio.mp3') {
                audio.src = '/audios/index/inicio.mp3';
                audio.loop = true;
            }
            audio.volume = isMuted ? 0 : volume;
            // The play() must be called after a user interaction in some browsers.
            // If it fails silently, the user can still trigger it via settings.
            audio.play().catch(e => console.warn("Menu audio auto-play was prevented. A user interaction is required.", e));
        } else {
            audio.pause();
            // Reset src to stop buffering
            audio.src = '';
        }
    }, [gameStage, playMenuMusic, volume, isMuted]);


    // Função para limpar o jogo salvo e ir para a tela de criação
    const startNewGameFlow = useCallback(() => {
        setGameStage('creating');
    }, []);

    // Função chamada pelo componente de criação quando o personagem está pronto
    const onCharacterCreated = useCallback(() => {
        setGameStage('created');
    }, []);
    
    // Função para finalmente entrar no jogo e fazer a primeira chamada à IA
    const onPlay = useCallback(() => {
        setGameStage('playing');
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

    return (
        <Game
            startNewGameFlow={startNewGameFlow}
            onCharacterCreated={onCharacterCreated}
            onContinueGame={onContinueGame}
            gameStage={gameStage}
        />
    );
};

// O componente principal agora envolve tudo com os Providers.
export default function HomePage() {
  return (
    <>
    <Head>
        <script src="/extras/dice-main/libs/teal.js" defer></script>
        <script src="/extras/dice-main/libs/three.min.js" defer></script>
        <script src="/extras/dice-main/libs/cannon.min.js" defer></script>
        <script src="/extras/dice-main/dice.js" defer></script>
    </Head>
    <main
      className="h-full w-full bg-gradient-to-br from-black via-stone-900 to-red-950 p-2 md:p-4 flex items-center justify-center"
    >
        <SettingsProvider>
            <GameStateProvider>
                <HomePageContent />
            </GameStateProvider>
        </SettingsProvider>
    </main>
    </>
  );
}