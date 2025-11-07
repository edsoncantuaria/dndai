// src/components/GameContainer.tsx
'use client';
import { useGameStateContext } from '@/contexts/GameStateContext';
import Game from '@/components/Game';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { Settings, User, Plus, Play, Trash2, ArrowLeft, BookOpen, Sword, FlaskConical, Beaker, GitMerge, LogOut, Languages, Sparkles } from 'lucide-react';
import PremiumLoader from '@/components/ui/PremiumLoader';
import SettingsModal from './SettingsModal';
import SystemTestModal from './system/SystemTestModal';
import * as GameService from '@/services/gameService';
import type { Character, SessaoIA } from '@/types';
import ActionModal from './ui/ActionModal';
import { useAuth } from '@/contexts/AuthContext';
import HomebrewStore from './Homebrew/HomebrewStore';
import ArchitectureHelpModal from './system/ArchitectureHelpModal';
import TranslationStudio from './Homebrew/TranslationStudio';
import { loadTranslations } from '@/utils/translator';


type GameStage = 'loading' | 'main_menu' | 'session_list' | 'character_vault' | 'creating_character' | 'playing' | 'homebrew_store' | 'translation_studio';


const PremiumLoader: React.FC<{ onCancel?: () => void }> = ({ onCancel }) => (
    <div className="min-h-screen w-full bg-[#02060d] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.15),_transparent_60%)]" />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-16 flex flex-col gap-10">
            <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-400/30 bg-amber-500/10 text-[10px] uppercase tracking-[0.45em] text-amber-200 animate-pulse">Sincronizando</div>
                <h2 className="text-3xl font-serif text-white">Preparando sua crônica</h2>
                <p className="text-sm text-stone-400">
                    Estamos recuperando o estado da mesa, inventário, aliados e missões. Aproveite o brilho enquanto o Mestre organiza a próxima cena.
                </p>
            </div>
            <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg animate-pulse">
                    <div className="h-4 w-32 bg-white/30 rounded-full mb-3" />
                    <div className="space-y-2">
                        <div className="h-3 bg-white/10 rounded-full w-full" />
                        <div className="h-3 bg-white/10 rounded-full w-5/6" />
                        <div className="h-3 bg-white/10 rounded-full w-4/6" />
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg animate-pulse space-y-3">
                            <div className="h-3 bg-white/20 rounded-full w-1/2" />
                            <div className="h-5 bg-white/30 rounded-full w-2/3" />
                            <div className="h-3 bg-white/10 rounded-full w-full" />
                        </div>
                    ))}
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg space-y-4 animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-white/10" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-white/20 rounded-full w-2/3" />
                            <div className="h-3 bg-white/10 rounded-full w-1/3" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="h-10 bg-white/10 rounded-2xl" />
                        <div className="h-10 bg-white/10 rounded-2xl" />
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Seu progresso continua salvo automaticamente.</span>
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="px-3 py-1.5 rounded-full border border-white/20 text-stone-200 hover:text-amber-200 hover:border-amber-300 transition-colors"
                    >
                        Voltar ao menu
                    </button>
                )}
            </div>
        </div>
    </div>
);

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
    const { logout, user } = useAuth(); // Obter a função de logout e o usuário
    const [gameStage, setGameStage] = useState<GameStage>('loading');
    const [sessions, setSessions] = useState<SessaoIA[]>([]);
    const [characters, setCharacters] = useState<Character[]>([]);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showTestModal, setShowTestModal] = useState(false);
    const [showArchitectureModal, setShowArchitectureModal] = useState(false); 
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
    const [sessionToDelete, setSessionToDelete] = useState<SessaoIA | null>(null);

    const menuAudioRef = useRef<HTMLAudioElement | null>(null);
    
    // --- Data Fetching ---
    const fetchInitialData = useCallback(async () => {
        setIsLoadingData(true);
        try {
            // Carrega traduções na inicialização
            await loadTranslations();

            const [userSessions, userCharacters] = await Promise.all([
                GameService.getGameSessions(),
                GameService.getCharacters()
            ]);
            const sortedSessions = (userSessions || [])
                .slice()
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setSessions(sortedSessions);
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
        const featuredSession = sessions[0];
        const hasSessions = sessions.length > 0;
        const heroMetrics = [
            { label: 'Sessões Ativas', value: sessions.length, detail: 'crônicas salvas' },
            { label: 'Heróis Prontos', value: characters.length, detail: 'personagens jogáveis' },
            { label: 'Homebrews', value: useAiHomebrew ? 'IA + Manual' : 'Manual', detail: 'fontes habilitadas' },
        ];

        const menuActions = [
            {
                title: 'Continuar aventura',
                description: hasSessions ? 'Retome instantaneamente a crônica mais recente.' : 'Crie um herói antes de continuar.',
                icon: BookOpen,
                gradient: 'from-amber-500/20 via-amber-300/5 to-transparent',
                accent: 'text-amber-300',
                disabled: !hasSessions,
                action: () => {
                    if (featuredSession) {
                        handleContinueGame(featuredSession.id);
                    } else {
                        setGameStage('session_list');
                    }
                },
                cta: hasSessions ? 'Retomar agora' : 'Escolher crônica'
            },
            {
                title: 'Nova jornada',
                description: 'Clone um herói e gere um cenário inédito em segundos.',
                icon: Sword,
                gradient: 'from-emerald-500/15 via-emerald-300/5 to-transparent',
                accent: 'text-emerald-300',
                action: () => setGameStage('character_vault'),
                cta: 'Abrir cofre'
            },
            {
                title: 'Oficina homebrew',
                description: 'Gerencie criaturas, itens e pacotes personalizados.',
                icon: FlaskConical,
                gradient: 'from-purple-500/20 via-purple-300/5 to-transparent',
                accent: 'text-purple-300',
                action: () => setGameStage('homebrew_store'),
                cta: 'Entrar'
            },
        ];

        // Master loading screen for playing stage (before personagem carregar)
        if (gameStage === 'playing' && !character) {
             return <PremiumLoader onCancel={returnToMenu} />;
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
                <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col gap-6 animate-fadeIn px-4 text-left">
                     <header className="space-y-2 text-center md:text-left">
                        <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Continuar</p>
                        <h1 className="text-4xl md:text-5xl font-bold text-amber-50 font-serif">Retome uma crônica</h1>
                        <p className="text-stone-400 mt-1">Selecione uma sessão salva para mergulhar direto na história.</p>
                    </header>
                    <main className="w-full space-y-3 max-h-[65vh] overflow-y-auto pr-1 sm:pr-2">
                         {sessions.length > 0 ? (
                            sessions.map(session => (
                                 <article
                                    key={session.id}
                                    className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex-1">
                                        <p className="text-xs uppercase tracking-wide text-stone-500">Atualizado em {new Date(session.updatedAt).toLocaleDateString()}</p>
                                        <h2 className="text-xl font-semibold text-stone-100 mt-1">{session.nome}</h2>
                                        <p className="text-sm text-stone-400">
                                            Herói: {session.character?.name} · {session.character?.characterClass} Nível {session.character?.level}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => handleContinueGame(session.id)}
                                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 transition-colors"
                                        >
                                            <Play className="h-4 w-4" />
                                            Retomar
                                        </button>
                                        <button
                                            onClick={() => setSessionToDelete(session)}
                                            className="inline-flex items-center gap-2 rounded-xl border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Excluir
                                        </button>
                                    </div>
                                </article>
                            ))
                        ) : (
                            <p className="text-stone-400 italic py-8 text-center">Nenhuma aventura em andamento.</p>
                        )}
                    </main>
                     <footer className="mt-2 flex justify-center">
                        <button onClick={() => setGameStage('main_menu')} className="text-stone-300 hover:text-amber-300 underline inline-flex items-center gap-2">
                           <ArrowLeft className="h-4 w-4" /> Voltar ao menu premium
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

        if (gameStage === 'translation_studio') {
            return <TranslationStudio onCancel={() => setGameStage('main_menu')} />;
        }

        // Default: main_menu or loading
        return (
            <div className="relative min-h-full flex flex-col overflow-x-hidden overflow-y-auto bg-[#02060d]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_55%)]" />
                <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-amber-500/5 via-transparent to-transparent blur-3xl" />
                <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-12 flex flex-col flex-grow gap-12 animate-fadeIn min-w-0">
                    <div className="space-y-6 md:hidden">
                        <div className="space-y-2">
                            <p className="text-[11px] uppercase tracking-[0.35em] text-amber-300">Mestre virtual</p>
                            <h1 className="text-3xl font-bold text-white font-serif leading-tight">Crônicas de Aventuras</h1>
                            <p className="text-stone-300 text-sm leading-relaxed">
                                Campanhas cinematográficas, combate estratégico e gerenciamento automatizado em um hub premium.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {heroMetrics.map(metric => (
                                <div key={metric.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                    <p className="text-xs uppercase tracking-wide text-stone-400">{metric.label}</p>
                                    <p className="text-2xl font-semibold text-white mt-1">{metric.value}</p>
                                    <p className="text-[11px] text-stone-500">{metric.detail}</p>
                                </div>
                            ))}
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-left backdrop-blur-md shadow-xl space-y-3">
                            {featuredSession ? (
                                <>
                                    <div className="space-y-1">
                                        <p className="text-xs uppercase tracking-wide text-amber-200">Última crônica</p>
                                        <h3 className="text-xl font-semibold text-white">{featuredSession.nome}</h3>
                                        <p className="text-sm text-stone-300">Herói: {featuredSession.character?.name}</p>
                                        <p className="text-[11px] uppercase tracking-wide text-stone-500">Atualizado em {new Date(featuredSession.updatedAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => handleContinueGame(featuredSession.id)}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400/90 px-4 py-3 text-base font-semibold text-stone-900 hover:bg-amber-300 transition-colors"
                                        >
                                            <Sparkles className="h-5 w-5" /> Retomar agora
                                        </button>
                                        <button
                                            onClick={() => setGameStage('session_list')}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3 text-base font-semibold text-stone-100 hover:border-amber-200/60 transition-colors"
                                        >
                                            <BookOpen className="h-5 w-5" /> Ver crônicas
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-2 text-stone-300">
                                    <p className="text-xs uppercase tracking-wide text-stone-500">Sem sessões recentes</p>
                                    <h3 className="text-xl font-semibold text-white">Inicie sua primeira mesa</h3>
                                    <p className="text-sm text-stone-400">Crie um herói no Cofre e gere um capítulo totalmente novo com a IA.</p>
                                    <button
                                        onClick={() => setGameStage('character_vault')}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400/90 px-4 py-3 text-base font-semibold text-stone-900 hover:bg-amber-300 transition-colors"
                                    >
                                        <Plus className="h-5 w-5" /> Criar herói
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <header className="hidden md:grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-stretch">
                        <div className="text-left space-y-6">
                            <p className="text-[11px] uppercase tracking-[0.35em] text-amber-300">Mestre virtual</p>
                            <div className="space-y-3">
                                <h1 className="text-4xl md:text-5xl font-bold text-white font-serif leading-tight">Crônicas de Aventuras</h1>
                                <p className="text-stone-300 text-lg leading-relaxed">
                                    Campanhas cinematográficas, combate estratégico e gerenciamento automatizado em um hub premium.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {heroMetrics.map(metric => (
                                    <div key={metric.label} className="rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm">
                                        <p className="text-xs uppercase tracking-wide text-stone-400">{metric.label}</p>
                                        <p className="text-3xl font-semibold text-white mt-1">{metric.value}</p>
                                        <p className="text-[11px] text-stone-500">{metric.detail}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left backdrop-blur-md flex flex-col justify-between shadow-xl">
                            {featuredSession ? (
                                <>
                                    <div className="space-y-2">
                                        <p className="text-xs uppercase tracking-wide text-amber-200">Última crônica</p>
                                        <h3 className="text-2xl font-semibold text-white">{featuredSession.nome}</h3>
                                        <p className="text-sm text-stone-300">
                                            Herói: {featuredSession.character?.name}
                                        </p>
                                        <p className="text-xs uppercase tracking-wide text-stone-500">
                                            Atualizado em {new Date(featuredSession.updatedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="mt-6 flex flex-wrap gap-3">
                                        <button
                                            onClick={() => handleContinueGame(featuredSession.id)}
                                            className="inline-flex flex-1 min-w-[160px] items-center justify-center gap-2 rounded-2xl bg-amber-400/90 px-4 py-3 text-base font-semibold text-stone-900 hover:bg-amber-300 transition-colors"
                                        >
                                            <Sparkles className="h-5 w-5" /> Retomar agora
                                        </button>
                                        <button
                                            onClick={() => setGameStage('session_list')}
                                            className="inline-flex flex-1 min-w-[160px] items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3 text-base font-semibold text-stone-100 hover:border-amber-200/60 transition-colors"
                                        >
                                            <BookOpen className="h-5 w-5" /> Ver crônicas
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-stone-300 space-y-3">
                                    <p className="text-xs uppercase tracking-wide text-stone-500">Sem sessões recentes</p>
                                    <h3 className="text-2xl font-semibold text-white">Inicie sua primeira mesa</h3>
                                    <p className="text-sm text-stone-400">
                                        Crie um herói no Cofre e gere um capítulo totalmente novo com a IA.
                                    </p>
                                    <button
                                        onClick={() => setGameStage('character_vault')}
                                        className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400/90 px-4 py-3 text-base font-semibold text-stone-900 hover:bg-amber-300 transition-colors"
                                    >
                                        <Plus className="h-5 w-5" /> Criar herói
                                    </button>
                                </div>
                            )}
                        </div>
                    </header>

                    <main className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                        {menuActions.map(action => (
                            <button
                                key={action.title}
                                onClick={action.action}
                                disabled={action.disabled}
                                className={`w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left shadow-lg flex flex-col gap-4 transition-all ${
                                    action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-amber-400/60 hover:bg-white/10'
                                }`}
                            >
                                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br ${action.gradient}`}>
                                    <action.icon className={`h-6 w-6 ${action.accent}`} />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xl font-semibold text-white">{action.title}</p>
                                    <p className="text-sm text-stone-400">{action.description}</p>
                                </div>
                                {action.cta && (
                                    <span className="text-sm font-semibold text-amber-200 mt-auto">{action.cta}</span>
                                )}
                            </button>
                        ))}
                    </main>

                    <footer className="w-full rounded-3xl border border-white/5 bg-white/5 p-5 backdrop-blur-sm mt-auto">
                        <div className="flex flex-wrap gap-3 justify-between">
                            <button
                                onClick={() => setShowSettingsModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-600 bg-stone-900/60 text-sm text-stone-200 hover:text-amber-200 hover:border-amber-300 transition-colors"
                            >
                                <Settings className="h-4 w-4" /> Configurações
                            </button>
                            <button
                                onClick={() => setShowArchitectureModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-600 bg-stone-900/60 text-sm text-stone-200 hover:text-amber-200 hover:border-amber-300 transition-colors"
                            >
                                <GitMerge className="h-4 w-4" /> Arquitetura
                            </button>
                            <button
                                onClick={() => setShowTestModal(true)}
                                className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-600 bg-stone-900/60 text-sm text-stone-200 hover:text-amber-200 hover:border-amber-300 transition-colors"
                            >
                                <Beaker className="h-4 w-4" /> Testes
                            </button>
                            {user?.id === 1 && (
                                <button
                                    onClick={() => setGameStage('translation_studio')}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-600 bg-stone-900/60 text-sm text-stone-200 hover:text-amber-200 hover:border-amber-300 transition-colors"
                                >
                                    <Languages className="h-4 w-4" /> Traduções
                                </button>
                            )}
                            <button
                                onClick={logout}
                                className="flex items-center gap-2 px-4 py-2 rounded-full border border-stone-600 bg-stone-900/60 text-sm text-stone-200 hover:text-red-300 hover:border-red-400 transition-colors"
                            >
                                <LogOut className="h-4 w-4" /> Sair
                            </button>
                        </div>
                    </footer>
                </div>
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
