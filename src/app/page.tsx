'use client';
import { GameStateProvider, useGameStateContext } from '@/contexts/GameStateContext';
import Game from '@/components/Game';
import { useState, useCallback, useEffect, useRef } from 'react';
import { SettingsProvider, useSettingsContext } from '@/contexts/SettingsContext';
import Head from 'next/head';
import { Settings } from 'lucide-react';
import SettingsModal from '@/components/SettingsModal';

// Define os estágios do jogo para controlar o fluxo da UI
type GameStage = 'menu' | 'creating' | 'created' | 'playing';

// Este componente agora contém a lógica principal da página e pode acessar o contexto.
const HomePageContent = () => {
    const { character, loadGameFromLocalStorage, startGame, clearGameState } = useGameStateContext();
    const { playMenuMusic, volume, isMuted } = useSettingsContext();
    const [gameStage, setGameStage] = useState<GameStage>('menu');
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const menuAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!menuAudioRef.current) {
            const audio = new Audio('/audios/index/inicio.mp3');
            audio.loop = true;
            menuAudioRef.current = audio;
        }
        
        const audio = menuAudioRef.current;
        const shouldPlay = playMenuMusic && (gameStage === 'menu' || gameStage === 'creating' || gameStage === 'created');

        audio.volume = isMuted ? 0 : volume;

        if (shouldPlay && audio.paused) {
            audio.play().catch(e => console.warn("Menu audio auto-play was prevented. A user interaction is required.", e));
        } else if (!shouldPlay && !audio.paused) {
            audio.pause();
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
    const onPlay = useCallback(async () => {
        // First, set the stage to playing to show the loading screen
        setGameStage('playing');
        // Then, attempt to start the game, which makes the initial API call.
        const success = await startGame();
        // If the API call fails, revert to the 'created' stage so the user isn't stuck.
        if (success === false) {
             // A mensagem de erro já terá sido definida pelo hook, então o ErrorModal aparecerá.
            setGameStage('created');
        }
    }, [startGame]);
    
    const onContinueGame = useCallback(() => {
        loadGameFromLocalStorage();
        setGameStage('playing');
    }, [loadGameFromLocalStorage]);
    
    const returnToMenu = useCallback(() => {
        clearGameState();
        setGameStage('menu');
    }, [clearGameState]);


    // No estágio 'created', mostramos uma tela intermediária com o botão "Continuar".
    if (gameStage === 'created') {
        return (
            <>
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <h2 className="text-3xl font-bold text-amber-300 font-garamond animate-fadeIn">Personagem Criado!</h2>
                    <p className="text-stone-400 mt-2 animate-fadeIn" style={{ animationDelay: '200ms' }}>Seu herói está pronto para a aventura.</p>
                    <div className="flex items-center gap-4 mt-8">
                        <button
                            onClick={onPlay}
                            className="menu-button btn-new animate-fadeIn"
                            style={{ animationDelay: '400ms' }}
                        >
                            Continuar
                        </button>
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="p-3 rounded-full bg-stone-700/80 hover:bg-stone-600 transition-colors animate-fadeIn"
                            style={{ animationDelay: '500ms' }}
                            title="Configurações"
                        >
                            <Settings className="h-6 w-6 text-amber-300" />
                        </button>
                    </div>
                </div>
                <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
            </>
        );
    }

    return (
        <Game
            startNewGameFlow={startNewGameFlow}
            onCharacterCreated={onCharacterCreated}
            onContinueGame={onContinueGame}
            returnToMenu={returnToMenu}
            gameStage={gameStage}
            startGame={startGame}
        />
    );
};

// O componente principal agora envolve tudo com os Providers.
export default function HomePage() {
  return (
    <>
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
