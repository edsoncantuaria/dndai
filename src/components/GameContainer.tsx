
'use client';
import { useGameStateContext } from '@/contexts/GameStateContext';
import Game from '@/components/Game';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { Settings } from 'lucide-react';
import SettingsModal from './SettingsModal';
import * as GameService from '@/services/gameService';
import { Loader2, Plus, Play } from 'lucide-react';

type GameStage = 'menu' | 'creating' | 'created' | 'playing' | 'loading';

const GameContainer = () => {
    const { character, startGame, clearGameState, loadGameSession, loadSessionId } = useGameStateContext();
    const { playMenuMusic, setPlayMenuMusic, volume, isMuted } = useSettingsContext();
    const [gameStage, setGameStage] = useState<GameStage>('loading');
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const menuAudioRef = useRef<HTMLAudioElement | null>(null);
    const [sessions, setSessions] = useState<{id: number, nome: string}[]>([]);

    const fetchSessions = useCallback(async () => {
        try {
            const userSessions = await GameService.getGameSessions();
            setSessions(userSessions);
        } catch(err) {
            console.error("Falha ao buscar sessões:", err);
            setSessions([]);
        }
    }, []);

    useEffect(() => {
        if (gameStage === 'loading') {
            fetchSessions().then(() => {
                const activeSessionId = loadSessionId();
                if (activeSessionId) {
                    onContinueGame(activeSessionId);
                } else {
                    setGameStage('menu');
                }
            });
        } else if (gameStage === 'menu') {
            fetchSessions();
        }
    }, [gameStage, fetchSessions, loadSessionId]);

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
            audio.play().catch(e => console.warn("Menu audio auto-play was prevented.", e));
        } else if (!shouldPlay && !audio.paused) {
            audio.pause();
        }
    }, [gameStage, playMenuMusic, volume, isMuted]);

    const startNewGameFlow = useCallback(() => setGameStage('creating'), []);
    const onCharacterCreated = useCallback(() => {
        setGameStage('created');
        setPlayMenuMusic(false);
    }, [setPlayMenuMusic]);
    
    const onPlay = useCallback(async () => {
        setGameStage('playing');
        setPlayMenuMusic(false);
        const success = await startGame();
        if (!success) {
            setGameStage('created');
            setPlayMenuMusic(true);
        }
    }, [startGame, setPlayMenuMusic]);
    
    const onContinueGame = useCallback((sessionId: number) => {
        loadGameSession(sessionId);
        setGameStage('playing');
        setPlayMenuMusic(false);
    }, [loadGameSession, setPlayMenuMusic]);
    
    const returnToMenu = useCallback(() => {
        clearGameState();
        setGameStage('menu');
        setPlayMenuMusic(true);
    }, [clearGameState, setPlayMenuMusic]);

    if (gameStage === 'loading') {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-stone-400 text-center">
                <Loader2 className="h-12 w-12 animate-spin" />
                <p className="mt-4 text-lg">Carregando suas aventuras...</p>
            </div>
        );
    }
    
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
    
    if (gameStage === 'menu') {
        return (
             <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center text-center">
                 <header className="mb-8 animate-fadeIn" style={{ animationDelay: '200ms' }}>
                    <h1 className="text-5xl md:text-7xl font-bold text-amber-50 font-serif" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
                        Sessões de Jogo
                    </h1>
                </header>
                <main className="w-full animate-fadeIn" style={{ animationDelay: '400ms' }}>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {sessions.length > 0 ? (
                            sessions.map(session => (
                                <button key={session.id} onClick={() => onContinueGame(session.id)} className="w-full text-left p-4 bg-stone-800/60 border-2 border-stone-700 rounded-lg hover:bg-stone-700/80 hover:border-amber-600 transition-all flex justify-between items-center">
                                    <span className="font-bold text-lg text-stone-200">{session.nome}</span>
                                    <Play className="h-6 w-6 text-amber-400" />
                                </button>
                            ))
                        ) : (
                            <p className="text-stone-400 italic">Nenhuma aventura salva encontrada.</p>
                        )}
                    </div>
                     <button onClick={startNewGameFlow} className="menu-button btn-new mt-6">
                        <Plus className="mr-2 h-6 w-6"/> Nova Aventura
                    </button>
                </main>
             </div>
        )
    }

    return (
        <Game
            startNewGameFlow={startNewGameFlow}
            onCharacterCreated={onCharacterCreated}
            returnToMenu={returnToMenu}
            gameStage={gameStage}
        />
    );
};

export default GameContainer;
