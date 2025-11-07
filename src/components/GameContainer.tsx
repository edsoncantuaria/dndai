// src/components/GameContainer.tsx
'use client';
import { useGameStateContext } from '@/contexts/GameStateContext';
import Game from '@/components/Game';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { Settings, User, Plus, Play, Trash2, ArrowLeft, BookOpen, Sword, FlaskConical, Beaker, GitMerge, LogOut, Languages, Sparkles, Crown, Shield, Clock } from 'lucide-react';
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

        if ((gameStage === 'loading' || isLoadingData) && gameStage !== 'playing') {
            return (
                <PremiumLoader
                    title="Abrindo o salão principal"
                    subtitle="Sincronizando personagens, crônicas e trilhas sonoras."
                    description="Buscando cofres, sessões salvas e recursos premium..."
                    actionLabel="Voltar ao menu"
                    onAction={() => setGameStage('main_menu')}
                />
            );
        }

        if (gameStage === 'session_list') {
            return (
                <div className="relative isolate min-h-screen w-full overflow-hidden bg-[#030812]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),transparent_60%)]" />
                    <div className="absolute -bottom-32 right-0 h-96 w-96 bg-emerald-500/20 blur-[160px]" />
                    <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12 sm:px-8">
                        <header className="space-y-3 text-center sm:text-left">
                            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Continuar</p>
                            <h1 className="text-4xl font-semibold text-white">Retome uma crônica</h1>
                            <p className="text-sm text-stone-400">
                                Todas as sessões ficam guardadas aqui. Continue do ponto exato onde parou.
                            </p>
                        </header>

                        <div className="grid gap-4">
                            {sessions.length > 0 ? (
                                sessions.map(session => {
                                    const updatedDate = new Date(session.updatedAt).toLocaleDateString();
                                    return (
                                        <article
                                            key={session.id}
                                            className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-5 backdrop-blur-md shadow-xl"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                                                        Atualizado em {updatedDate}
                                                    </p>
                                                    <h2 className="text-2xl font-semibold text-white">{session.nome}</h2>
                                                    <p className="text-sm text-stone-300">
                                                        Herói: {session.character?.name} · {session.character?.characterClass} Nível {session.character?.level}
                                                    </p>
                                                </div>
                                                <span className="rounded-full border border-white/10 px-4 py-1 text-xs text-stone-400">
                                                    Sessão #{session.id}
                                                </span>
                                            </div>
                                            <div className="mt-4 flex flex-wrap gap-3">
                                                <button
                                                    onClick={() => handleContinueGame(session.id)}
                                                    className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-2xl bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300 transition-colors"
                                                >
                                                    <Play className="h-4 w-4" /> Retomar
                                                </button>
                                                <button
                                                    onClick={() => setSessionToDelete(session)}
                                                    className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-2xl border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10 transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" /> Excluir
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })
                            ) : (
                                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-stone-300">
                                    <p className="text-sm">Nenhuma aventura em andamento. Crie um herói e inicie o primeiro capítulo.</p>
                                    <button
                                        onClick={() => setGameStage('character_vault')}
                                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/40 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 transition"
                                    >
                                        <Plus className="h-4 w-4" /> Abrir cofres
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap justify-between gap-3">
                            <button
                                onClick={() => setGameStage('main_menu')}
                                className="inline-flex items-center gap-2 text-sm text-stone-300 hover:text-amber-200 transition"
                            >
                                <ArrowLeft className="h-4 w-4" /> Voltar ao menu premium
                            </button>
                            <button
                                onClick={() => setGameStage('character_vault')}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-stone-100 hover:border-amber-200/60 transition"
                            >
                                <User className="h-4 w-4" /> Cofre de heróis
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (gameStage === 'character_vault') {
            const vaultStats = [
                { label: 'Heróis forjados', value: characters.length || '0' },
                {
                    label: 'Última atualização',
                    value: characters[0]?.updatedAt ? new Date(characters[0].updatedAt).toLocaleDateString() : '--/--',
                },
                { label: 'Sessões salvas', value: sessions.length || '0' },
            ];

            return (
                <div className="relative isolate min-h-screen w-full overflow-hidden bg-[#04070f]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.15),transparent_60%)]" />
                    <div className="absolute -top-32 right-0 h-96 w-96 bg-rose-500/20 blur-[180px]" />
                    <div className="absolute bottom-0 left-0 h-72 w-72 bg-emerald-500/15 blur-[160px]" />

                    <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-8">
                        <header className="flex flex-col gap-4 text-center sm:text-left">
                            <div className="inline-flex items-center gap-2 self-center rounded-full border border-amber-400/40 px-4 py-1 text-[11px] uppercase tracking-[0.4em] text-amber-200 sm:self-start">
                                Cofre de Heróis
                            </div>
                            <div className="space-y-3">
                                <h1 className="text-4xl font-semibold text-white sm:text-5xl">Escolha o protagonista da próxima saga</h1>
                                <p className="text-sm text-stone-400">
                                    Reviva crônicas antigas ou crie um herói inédito para desbloquear narrativas exclusivas com IA.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                <button
                                    onClick={() => setGameStage('creating_character')}
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-400/90 px-5 py-3 text-sm font-semibold text-stone-900 hover:bg-amber-300 transition"
                                >
                                    <Plus className="h-4 w-4" /> Criar novo herói
                                </button>
                                <button
                                    onClick={() => setGameStage('main_menu')}
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-stone-100 hover:border-amber-200/60 transition"
                                >
                                    <ArrowLeft className="h-4 w-4" /> Voltar ao menu
                                </button>
                            </div>
                        </header>

                        <div className="grid gap-3 sm:grid-cols-3">
                            {vaultStats.map(stat => (
                                <div key={stat.label} className="rounded-3xl border border-white/5 bg-white/5 p-4 text-center backdrop-blur">
                                    <p className="text-xs uppercase tracking-[0.4em] text-stone-500">{stat.label}</p>
                                    <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
                                </div>
                            ))}
                        </div>

                        {characters.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {characters.map(char => {
                                    const updatedAt = new Date(char.updatedAt).toLocaleDateString('pt-BR');
                                    return (
                                        <article
                                            key={char.id}
                                            className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-white/5 p-5 text-left backdrop-blur shadow-xl"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.4em] text-stone-500">#{char.id}</p>
                                                    <h3 className="text-2xl font-semibold text-amber-50">{char.name}</h3>
                                                    <p className="text-sm text-stone-300">
                                                        {char.race}
                                                        {char.subrace ? ` (${char.subrace})` : ''} · {char.alignment}
                                                    </p>
                                                </div>
                                                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-xs text-stone-200">
                                                    <Crown className="h-3.5 w-3.5" /> Nível {char.level}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-xs text-stone-400">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="h-3.5 w-3.5 text-stone-500" />
                                                    {char.characterClass}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-3.5 w-3.5 text-stone-500" />
                                                    Atualizado em {updatedAt}
                                                </div>
                                                <div className="col-span-2">
                                                    <p>
                                                        Antecedente: <span className="text-stone-200">{char.background}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-auto flex flex-col sm:flex-row gap-3">
                                                <button
                                                    onClick={() => handleNewGameFromVault(char as Character)}
                                                    className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-2xl bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300 transition"
                                                >
                                                    <Play className="h-4 w-4" /> Iniciar aventura
                                                </button>
                                                <button
                                                    onClick={() => setCharacterToDelete(char as Character)}
                                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10 transition"
                                                >
                                                    <Trash2 className="h-4 w-4" /> Excluir
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-stone-300">
                                <p className="text-sm">Nenhum herói foi forjado ainda. Que tal criar o primeiro campeão?</p>
                                <button
                                    onClick={() => setGameStage('creating_character')}
                                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/40 px-5 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 transition"
                                >
                                    <Plus className="h-4 w-4" /> Criar agora
                                </button>
                            </div>
                        )}
                    </div>
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
