// src/components/GameContainer.tsx
'use client';
import { useGameStateContext } from '@/contexts/GameStateContext';
import Game from '@/components/Game';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { Settings, User, Plus, Play, Trash2, ArrowLeft, BookOpen, Sword, FlaskConical, Beaker, GitMerge } from 'lucide-react';
import SettingsModal from './SettingsModal';
import SystemTestModal from './SystemTestModal';
import * as GameService from '@/services/gameService';
import * as HomebrewService from '@/services/homebrewService';
import type { Character, SessaoIA } from '@/types';
import ActionModal from './ui/ActionModal';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import HomebrewStore from './Homebrew/HomebrewStore';
import ArchitectureHelpModal from './system/ArchitectureHelpModal';


type GameStage = 'loading' | 'main_menu' | 'session_list' | 'character_vault' | 'creating_character' | 'playing' | 'homebrew_store';


const GameContainer = () => {
    const {
        character,
        loadGameSession,
        clearGameState,
        deleteCharacter,
        deleteSession,
        isLoading: isGameLoading,
        apiError,
    } = useGameStateContext();

    const { useAiHomebrew } = useSettingsContext();
    const { playMenuMusic, setPlayMenuMusic, volume, isMuted } = useSettingsContext();
    const [gameStage, setGameStage] = useState<GameStage>('loading');
    const [sessions, setSessions] = useState<SessaoIA[]>([]);
    const [characters, setCharacters] = useState<Character[]>([]);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showTestModal, setShowTestModal] = useState(false);
    const [showArchitectureModal, setShowArchitectureModal] = useState(false); // Novo estado
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
    const [sessionToDelete, setSessionToDelete] = useState<SessaoIA | null>(null);

    const menuAudioRef = useRef<HTMLAudioElement | null>(null);
    
    // --- Data Fetching ---
    const fetchInitialData = useCallback(async () => {
        setIsLoadingData(true);
        try {
            const [userSessions, userCharacters] = await Promise.all([
                GameService.getGameSessions(),
                GameService.getCharacters()
            ]);
            setSessions(userSessions || []);
            setCharacters(userCharacters || []);
        } catch (err) {
            console.error("[GameContainer] Falha ao buscar dados iniciais:", err);
        } finally {
            setIsLoadingData(false);
        }
    }, []);

    useEffect(() => {
        if (apiError) {
            setGameStage('main_menu');
        }
    }, [apiError]);

    useEffect(() => {
        if (gameStage === 'loading' || gameStage === 'main_menu' || gameStage === 'session_list' || gameStage === 'character_vault') {
            fetchInitialData();
        }
    }, [gameStage, fetchInitialData]);

    useEffect(() => {
        if (!isLoadingData && gameStage === 'loading') {
            setGameStage('main_menu');
        }
    }, [isLoadingData, gameStage]);


    // --- Audio Management ---
    useEffect(() => {
        if (!menuAudioRef.current) {
            const audio = new Audio('/audios/index/inicio.mp3');
            audio.loop = true;
            menuAudioRef.current = audio;
        }

        const audio = menuAudioRef.current;
        const shouldPlay = playMenuMusic && (gameStage !== 'playing');
        audio.volume = isMuted ? 0 : volume;

        if (shouldPlay && audio.paused) {
            audio.play().catch(e => console.warn("Menu audio auto-play was prevented.", e));
        } else if (!shouldPlay && !audio.paused) {
            audio.pause();
        }
    }, [gameStage, playMenuMusic, volume, isMuted]);

    // --- Navigation and Actions ---
    const handleNewGameFromVault = useCallback(async (char: Character) => {
        setGameStage('playing'); // Switch stage to show loading in GameScreen
        try {
            const { sessao } = await GameService.createGameSession(`Aventura de ${char.name}`, char.id);
            if (sessao) {
                await loadGameSession(sessao.id);
            } else {
                throw new Error("Failed to create a new session from the server.");
            }
        } catch (error) {
            console.error("[GameContainer] Failed to start new game session:", error);
            setGameStage('main_menu');
        }
    }, [loadGameSession]);
    
    const handleCharacterCreated = () => {
        setGameStage('character_vault');
        fetchInitialData(); // Refresh character list
    }

    const handleContinueGame = useCallback(async (sessionIdToLoad: number) => {
        setGameStage('playing'); // Immediately switch to playing stage to show loader
        const loadedData = await loadGameSession(sessionIdToLoad);
        if (loadedData) {
            setPlayMenuMusic(false);
        } else {
            setGameStage('main_menu');
        }
    }, [loadGameSession, setPlayMenuMusic]);


    const returnToMenu = useCallback(() => {
        clearGameState();
        setGameStage('main_menu');
        setPlayMenuMusic(true);
    }, [clearGameState, setPlayMenuMusic]);

    const confirmDeleteCharacter = useCallback(async () => {
        if (!characterToDelete) return;
        await deleteCharacter(characterToDelete.id);
        setCharacterToDelete(null);
        fetchInitialData(); // Refresh list
    }, [characterToDelete, deleteCharacter, fetchInitialData]);

    const confirmDeleteSession = useCallback(async () => {
        if (!sessionToDelete) return;
        await deleteSession(sessionToDelete.id);
        setSessionToDelete(null);
        fetchInitialData(); // Refresh list
    }, [sessionToDelete, deleteSession, fetchInitialData]);

    // --- Render Logic ---

    const renderContent = () => {
        // Master loading screen for playing stage
        if (gameStage === 'playing' && (isGameLoading || !character)) {
             return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-stone-400 text-center">
                    <Loader2 className="h-12 w-12 animate-spin" />
                    <p className="mt-4 text-lg">Carregando suas crônicas...</p>
                </div>
            );
        }

        // Once loaded, if the stage is 'playing', render the Game component.
        if (gameStage === 'playing' && character) {
            return (
                <Game
                    onCharacterCreated={handleCharacterCreated}
                    returnToMenu={returnToMenu}
                    gameStage={gameStage}
                />
            );
        }

        if (gameStage === 'session_list') {
             return (
                <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center text-center animate-fadeIn">
                     <header className="mb-8">
                        <h1 className="text-5xl md:text-7xl font-bold text-amber-50 font-serif text-shadow-amber">Continuar Aventura</h1>
                        <p className="text-stone-400 mt-2">Escolha uma de suas jornadas salvas.</p>
                    </header>
                    <main className="w-full space-y-4 max-h-96 overflow-y-auto pr-2">
                         {sessions.length > 0 ? (
                            sessions.map(session => (
                                 <div key={session.id} className="w-full text-left p-4 bg-stone-800/60 border-2 border-stone-700 rounded-lg hover:bg-stone-700/80 hover:border-amber-600 transition-all flex justify-between items-center group">
                                    <div>
                                        <span className="font-bold text-xl text-stone-200 group-hover:text-amber-300 transition-colors">{session.nome}</span>
                                        <p className="text-sm text-stone-400">Herói: {session.character?.name} ({session.character?.characterClass} Nível {session.character?.level})</p>
                                        <p className="text-xs text-stone-500 mt-1">Última vez jogado: {new Date(session.updatedAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleContinueGame(session.id)} className="p-3 bg-green-700/80 hover:bg-green-600 rounded-md transition-transform group-hover:scale-110" title="Continuar Aventura">
                                            <Play className="h-6 w-6 text-white" />
                                        </button>
                                        <button onClick={() => setSessionToDelete(session)} className="p-3 bg-red-800/80 hover:bg-red-700 rounded-md transition-transform group-hover:scale-110" title="Deletar Sessão">
                                            <Trash2 className="h-6 w-6 text-white" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-stone-400 italic py-8">Nenhuma aventura em andamento.</p>
                        )}
                    </main>
                     <footer className="mt-6">
                        <button onClick={() => setGameStage('main_menu')} className="text-stone-300 hover:text-amber-300 underline flex items-center gap-2 mx-auto">
                           <ArrowLeft className="h-4 w-4" /> Voltar ao Menu Principal
                        </button>
                    </footer>
                </div>
            )
        }

        if (gameStage === 'character_vault') {
            return (
                <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center text-center animate-fadeIn">
                    <header className="mb-8">
                        <h1 className="text-5xl md:text-7xl font-bold text-amber-50 font-serif text-shadow-amber">Cofre de Heróis</h1>
                        <p className="text-stone-400 mt-2">Escolha um herói para uma nova aventura ou crie um novo campeão.</p>
                    </header>
                    <main className="w-full space-y-4 max-h-96 overflow-y-auto pr-2">
                        {characters.length > 0 ? (
                            characters.map(char => (
                                <div key={char.id} className="w-full text-left p-4 bg-stone-800/60 border-2 border-stone-700 rounded-lg hover:bg-stone-700/80 hover:border-amber-600 transition-all flex justify-between items-center">
                                    <div>
                                        <p className="font-bold text-lg text-stone-200">{char.name}</p>
                                        <p className="text-sm text-stone-400">{char.race} {char.characterClass}, Nível {char.level}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleNewGameFromVault(char as Character)} className="p-2 bg-green-700/80 hover:bg-green-600 rounded-md" title="Iniciar Nova Aventura">
                                            <Play className="h-6 w-6 text-white" />
                                        </button>
                                        <button onClick={() => setCharacterToDelete(char as Character)} className="p-2 bg-red-800/80 hover:bg-red-700 rounded-md" title="Deletar Personagem">
                                            <Trash2 className="h-6 w-6 text-white" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-stone-400 italic py-8">Nenhum herói foi forjado ainda.</p>
                        )}
                    </main>
                    <footer className="mt-6 flex items-center justify-center gap-4">
                        <button onClick={() => setGameStage('creating_character')} className="menu-button btn-new">
                            <User className="mr-2 h-6 w-6"/> Criar Novo Herói
                        </button>
                        <button onClick={() => setGameStage('main_menu')} className="text-stone-300 hover:text-amber-300 underline flex items-center gap-2">
                           <ArrowLeft className="h-4 w-4" /> Voltar ao Menu Principal
                        </button>
                    </footer>
                </div>
            );
        }

        if(gameStage === 'creating_character') {
            return <Game
                onCharacterCreated={handleCharacterCreated}
                returnToMenu={returnToMenu}
                gameStage={gameStage}
            />;
        }

        if (gameStage === 'homebrew_store') {
            return <HomebrewStore returnToMenu={() => setGameStage('main_menu')} />;
        }

        // Default: main_menu or loading
        return (
            <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center text-center animate-fadeIn">
                 <header className="mb-10" style={{ animationDelay: '200ms' }}>
                    <h1 className="text-6xl md:text-8xl font-bold text-amber-50 font-serif text-shadow-amber">
                        Crônicas de Aventuras
                    </h1>
                    <p className="text-stone-400 text-lg mt-4">Uma experiência de RPG gerada por Inteligência Artificial</p>
                </header>
                 <main className="w-full flex flex-col items-center gap-4" style={{ animationDelay: '400ms' }}>
                    <button onClick={() => setGameStage('session_list')} className="menu-button btn-new max-w-sm text-2xl py-5">
                       <BookOpen className="mr-3 h-7 w-7"/> Continuar Aventura
                    </button>
                    <button onClick={() => setGameStage('character_vault')} className="menu-button btn-import max-w-sm text-2xl py-5">
                        <Sword className="mr-3 h-7 w-7"/> Nova Jornada
                    </button>
                    <button onClick={() => setGameStage('homebrew_store')} className="menu-button btn-import max-w-sm text-lg py-3 bg-gradient-to-r from-purple-800 via-purple-700 to-purple-800 border-purple-600 hover:border-purple-500">
                        <FlaskConical className="mr-3 h-6 w-6"/> Oficina Homebrew
                    </button>
                </main>
                 <footer className="mt-12 flex justify-center gap-6">
                    <button 
                        onClick={() => setShowSettingsModal(true)} 
                        className="p-3 text-stone-400 hover:text-amber-300 transition-colors flex items-center gap-2 text-sm"
                        title="Configurações"
                    >
                        <Settings className="h-5 w-5"/> Configurações
                    </button>
                     <button 
                        onClick={() => setShowArchitectureModal(true)} 
                        className="p-3 text-stone-400 hover:text-amber-300 transition-colors flex items-center gap-2 text-sm"
                        title="Arquitetura de Dados"
                    >
                        <GitMerge className="h-5 w-5"/> Arquitetura
                    </button>
                     <button 
                        onClick={() => setShowTestModal(true)} 
                        className="p-3 text-stone-400 hover:text-amber-300 transition-colors flex items-center gap-2 text-sm"
                        title="Testes do Sistema"
                    >
                        <Beaker className="h-5 w-5"/> Testes
                    </button>
                </footer>
            </div>
        );
    }

    return (
        <>
            {renderContent()}

            {characterToDelete && (
                <ActionModal
                    isOpen={!!characterToDelete}
                    title={`Deletar ${characterToDelete.name}?`}
                    onClose={() => setCharacterToDelete(null)}
                    actions={[
                        { text: "Cancelar", onClick: () => setCharacterToDelete(null), variant: 'secondary' },
                        { text: "Confirmar Deleção", onClick: confirmDeleteCharacter, variant: 'destructive' }
                    ]}
                >
                    <p className="text-stone-300">Esta ação é irreversível e irá apagar o personagem permanentemente. Tem certeza?</p>
                </ActionModal>
            )}

            {sessionToDelete && (
                <ActionModal
                    isOpen={!!sessionToDelete}
                    title={`Deletar Sessão "${sessionToDelete.nome}"?`}
                    onClose={() => setSessionToDelete(null)}
                    actions={[
                        { text: "Cancelar", onClick: () => setSessionToDelete(null), variant: 'secondary' },
                        { text: "Confirmar Deleção", onClick: confirmDeleteSession, variant: 'destructive' }
                    ]}
                >
                    <p className="text-stone-300">Tem certeza de que deseja apagar o progresso desta aventura? Esta ação não pode ser desfeita.</p>
                </ActionModal>
            )}

            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />
            <SystemTestModal
                isOpen={showTestModal}
                onClose={() => setShowTestModal(false)}
                characters={characters as Character[]}
            />
            <ArchitectureHelpModal
                isOpen={showArchitectureModal}
                onClose={() => setShowArchitectureModal(false)}
            />
        </>
    );
};

export default GameContainer;
