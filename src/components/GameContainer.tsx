// src/components/GameContainer.tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import SettingsModal from './SettingsModal';
import SystemTestModal from './system/SystemTestModal';
import * as GameService from '@/services/gameService';
import type { Character, SessaoIA } from '@/types';
import ActionModal from './ui/ActionModal';
import { useAuth } from '@/contexts/AuthContext';
import ArchitectureHelpModal from './system/ArchitectureHelpModal';
import { loadTranslations } from '@/utils/translator';
import type { SessionFactsResponse } from '@/services/gameService';
import { useToast } from '@/hooks/use-toast';
import GameMenuContent from './game-menu/GameMenuContent';
import { GameStage } from '@/types/gameStage';
import { Loader2, MoreVertical } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { ArrowLeft, BookOpen, Edit, Plus, Trash2, Copy, Play } from 'lucide-react';
import { cn } from '@/lib/utils';


const GameContainer = () => {
    const {
        character,
        loadGameSession,
        clearGameState,
        deleteCharacter,
        deleteSession,
        apiError,
    } = useGameStateContext();

    const { useAiHomebrew, playMenuMusic, setPlayMenuMusic, volume, isMuted } = useSettingsContext();
    const { logout, user } = useAuth();
    const { toast } = useToast();

    const [gameStage, setGameStage] = useState<GameStage>('loading');
    const [sessions, setSessions] = useState<SessaoIA[]>([]);
    const [characters, setCharacters] = useState<Character[]>([]);
    const [featuredSessionFacts, setFeaturedSessionFacts] = useState<SessionFactsResponse | null>(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showTestModal, setShowTestModal] = useState(false);
    const [showArchitectureModal, setShowArchitectureModal] = useState(false); 
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
    const [sessionToDelete, setSessionToDelete] = useState<SessaoIA | null>(null);
    const [sessionToRename, setSessionToRename] = useState<SessaoIA | null>(null);
    const [newSessionName, setNewSessionName] = useState('');
    const [sessionToClone, setSessionToClone] = useState<SessaoIA | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);


    const menuAudioRef = useRef<HTMLAudioElement | null>(null);
    
    const fetchInitialData = useCallback(async () => {
        setIsLoadingData(true);
        try {
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

            if (sortedSessions.length > 0) {
                const latestSessionId = sortedSessions[0].id;
                try {
                    const facts = await GameService.getSessionFacts(latestSessionId);
                    setFeaturedSessionFacts(facts);
                } catch (factError) {
                    console.warn(`[GameContainer] Não foi possível carregar os fatos da sessão ${latestSessionId}:`, factError);
                    setFeaturedSessionFacts(null);
                }
            } else {
                setFeaturedSessionFacts(null);
            }

        } catch (err) {
            console.error('[GameContainer] Falha ao buscar dados iniciais:', err);
        } finally {
            setIsLoadingData(false);
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
            audio.play().catch(e => console.warn('Menu audio auto-play was prevented.', e));
        } else if (!shouldPlay && !audio.paused) {
            audio.pause();
        }
    }, [gameStage, playMenuMusic, volume, isMuted]);

    const handleNewGameFromVault = useCallback(async (char: Character) => {
        setGameStage('playing');
        try {
            const { sessao } = await GameService.createGameSession(`Aventura de ${char.name}`, char.id);
            if (sessao) {
                await loadGameSession(sessao.id);
            } else {
                throw new Error('Failed to create a new session from the server.');
            }
        } catch (error) {
            console.error('[GameContainer] Failed to start new game session:', error);
            setGameStage('main_menu');
        }
    }, [loadGameSession]);
    
    const handleCharacterCreated = () => {
        setGameStage('character_vault');
        fetchInitialData();
    };

    const handleContinueGame = useCallback(async (sessionIdToLoad: number) => {
        setGameStage('playing');
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
        fetchInitialData();
    }, [characterToDelete, deleteCharacter, fetchInitialData]);

    const confirmDeleteSession = useCallback(async () => {
        if (!sessionToDelete) return;
        await deleteSession(sessionToDelete.id);
        setSessionToDelete(null);
        fetchInitialData();
    }, [sessionToDelete, deleteSession, fetchInitialData]);
    
    const confirmRenameSession = useCallback(async () => {
        if (!sessionToRename || !newSessionName.trim()) return;
        setIsActionLoading(true);
        try {
            await GameService.renameGameSession(sessionToRename.id, newSessionName);
            toast({ title: 'Sessão Renomeada!', description: `Sua aventura agora se chama "${newSessionName}".` });
            fetchInitialData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha ao Renomear', description: error.message });
        } finally {
            setSessionToRename(null);
            setNewSessionName('');
            setIsActionLoading(false);
        }
    }, [sessionToRename, newSessionName, fetchInitialData, toast]);
    
    const confirmCloneSession = useCallback(async () => {
        if (!sessionToClone) return;
        setIsActionLoading(true);
        try {
            await GameService.cloneGameSession(sessionToClone.id);
            toast({ title: 'Aventura Clonada!', description: 'Uma nova linha do tempo foi criada com sucesso.' });
            fetchInitialData();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Falha na Clonagem', description: error.message });
        } finally {
            setSessionToClone(null);
            setIsActionLoading(false);
        }
    }, [sessionToClone, fetchInitialData, toast]);

    const requestDeleteCharacter = useCallback((char: Character) => {
        setCharacterToDelete(char);
    }, []);

    const requestDeleteSession = useCallback((session: SessaoIA) => {
        setSessionToDelete(session);
    }, []);

    const requestRenameSession = useCallback((session: SessaoIA) => {
        setSessionToRename(session);
        setNewSessionName(session.nome);
    }, []);

    const requestCloneSession = useCallback((session: SessaoIA) => {
        setSessionToClone(session);
    }, []);

    const openSettings = useCallback(() => setShowSettingsModal(true), []);
    const openSystemTests = useCallback(() => setShowTestModal(true), []);
    const openArchitecture = useCallback(() => setShowArchitectureModal(true), []);

    if (gameStage === 'session_list') {
        return (
            <TooltipProvider>
                <div className="relative isolate min-h-full w-full overflow-y-auto bg-[#030812]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),transparent_60%)]" />
                    <div className="absolute -bottom-32 right-0 h-96 w-96 bg-emerald-500/20 blur-[160px]" />
                    <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12 md:py-16">
                        <header className="space-y-3 text-center sm:text-left">
                            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Continuar</p>
                            <h1 className="text-4xl font-semibold text-white">Retome uma crônica</h1>
                            <p className="text-sm text-stone-400">
                                Todas as sessões ficam guardadas aqui. Continue do ponto exato onde parou.
                            </p>
                        </header>

                        <div className="grid gap-4" ref={dropdownRef}>
                            {sessions.length > 0 ? (
                                sessions.map(session => {
                                    const updatedDate = new Date(session.updatedAt).toLocaleDateString();
                                    const cardId = session.id;
                                    return (
                                        <article
                                            key={session.id}
                                            className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-5 backdrop-blur-md shadow-xl"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex-grow min-w-0">
                                                    <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Sessão</p>
                                                    <h2 className="text-2xl font-semibold text-white truncate">{session.nome}</h2>
                                                    <p className="text-sm text-stone-300 truncate">
                                                        Herói: {session.character?.name} — Último acesso em {updatedDate}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => onContinueGame(session.id)}
                                                        className="inline-flex items-center gap-2 rounded-full bg-amber-400/90 px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-amber-300 transition"
                                                    >
                                                        <Play className="h-4 w-4" /> Retomar
                                                    </button>
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setDropdownOpen(dropdownOpen === cardId ? null : cardId)}
                                                            className="rounded-full border border-white/20 p-2 text-stone-200 hover:text-amber-200"
                                                        >
                                                            <MoreVertical className="h-5 w-5" />
                                                        </button>
                                                        <AnimatePresence>
                                                            {dropdownOpen === cardId && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: -10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, y: -10 }}
                                                                    className="absolute right-0 mt-2 w-48 bg-stone-800 border border-stone-600 rounded-md shadow-lg z-10"
                                                                >
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <button
                                                                                onClick={() => { onRequestRenameSession(session); setDropdownOpen(null); }}
                                                                                className="w-full text-left px-4 py-2 text-sm text-stone-200 hover:bg-stone-700 flex items-center gap-2"
                                                                            >
                                                                                <Edit className="h-4 w-4" />Renomear
                                                                            </button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent><p>Mude o nome da sua aventura.</p></TooltipContent>
                                                                    </Tooltip>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <button
                                                                                onClick={() => { onRequestCloneSession(session); setDropdownOpen(null); }}
                                                                                className="w-full text-left px-4 py-2 text-sm text-stone-200 hover:bg-stone-700 flex items-center gap-2"
                                                                            >
                                                                                <Copy className="h-4 w-4" />Clonar
                                                                            </button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent><p>Cria uma nova linha do tempo a partir deste ponto.</p></TooltipContent>
                                                                    </Tooltip>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <button
                                                                                onClick={() => { onRequestDeleteSession(session); setDropdownOpen(null); }}
                                                                                className="w-full text-left px-4 py-2 text-sm text-red-300 hover:bg-red-900/50 flex items-center gap-2"
                                                                            >
                                                                                <Trash2 className="h-4 w-4" /> Excluir
                                                                            </button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent><p>Exclui permanentemente esta aventura.</p></TooltipContent>
                                                                    </Tooltip>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })
                            ) : (
                                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-stone-300">
                                    <p className="text-sm">Nenhuma aventura em andamento. Crie um herói e inicie o primeiro capítulo.</p>
                                    <button
                                        onClick={() => onSetStage('character_vault')}
                                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/40 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 transition"
                                    >
                                        <Plus className="h-4 w-4" /> Abrir cofres
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap justify-between gap-3">
                            <button
                                onClick={() => onSetStage('main_menu')}
                                className="inline-flex items-center gap-2 text-sm text-stone-300 hover:text-amber-200 transition"
                            >
                                <ArrowLeft className="h-4 w-4" /> Voltar ao menu premium
                            </button>
                            <button
                                onClick={() => onSetStage('character_vault')}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-stone-100 hover:border-amber-200/60 transition"
                            >
                                <User className="h-4 w-4" /> Cofre de heróis
                            </button>
                        </div>
                    </div>
                </div>
            </TooltipProvider>
        );
    }


    return (
        <>
            <GameMenuContent
                gameStage={gameStage}
                character={character}
                sessions={sessions}
                characters={characters}
                featuredSessionFacts={featuredSessionFacts}
                useAiHomebrew={useAiHomebrew}
                isLoadingData={isLoadingData}
                onSetStage={onSetStage}
                onReturnToMenu={returnToMenu}
                onContinueGame={handleContinueGame}
                onCharacterCreated={handleCharacterCreated}
                onStartFromVault={handleNewGameFromVault}
                onRequestDeleteCharacter={requestDeleteCharacter}
                onRequestDeleteSession={requestDeleteSession}
                onRequestRenameSession={requestRenameSession}
                onRequestCloneSession={requestCloneSession}
                onOpenSettings={openSettings}
                onOpenSystemTests={openSystemTests}
                onOpenArchitecture={openArchitecture}
                onLogout={logout}
                user={user}
            />

            {characterToDelete && (
                <ActionModal
                    isOpen={!!characterToDelete}
                    title={`Deletar ${characterToDelete.name}?`}
                    onClose={() => setCharacterToDelete(null)}
                    actions={[
                        { text: 'Cancelar', onClick: () => setCharacterToDelete(null), variant: 'secondary' },
                        { text: 'Confirmar Deleção', onClick: confirmDeleteCharacter, variant: 'destructive' }
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
                        { text: 'Cancelar', onClick: () => setSessionToDelete(null), variant: 'secondary' },
                        { text: 'Confirmar Deleção', onClick: confirmDeleteSession, variant: 'destructive' }
                    ]}
                >
                    <p className="text-stone-300">Tem certeza de que deseja apagar o progresso desta aventura? Esta ação não pode ser desfeita.</p>
                </ActionModal>
            )}

            {sessionToRename && (
                <ActionModal
                    isOpen={!!sessionToRename}
                    title="Renomear Sessão"
                    onClose={() => setSessionToRename(null)}
                    actions={[
                        { text: 'Cancelar', onClick: () => setSessionToRename(null), variant: 'secondary' },
                        { text: 'Salvar Nome', onClick: confirmRenameSession, variant: 'primary', disabled: isActionLoading, icon: isActionLoading ? <Loader2 className="animate-spin h-4 w-4" /> : undefined }
                    ]}
                >
                    <input
                        type="text"
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        className="w-full bg-stone-800 border-stone-600 rounded-md p-2 text-stone-200"
                        maxLength={42}
                    />
                </ActionModal>
            )}

            {sessionToClone && (
                <ActionModal
                    isOpen={!!sessionToClone}
                    title={`Clonar "${sessionToClone.nome}"?`}
                    onClose={() => setSessionToClone(null)}
                    actions={[
                        { text: 'Cancelar', onClick: () => setSessionToClone(null), variant: 'secondary' },
                        { text: 'Sim, Criar Linha do Tempo', onClick: confirmCloneSession, variant: 'primary', disabled: isActionLoading, icon: isActionLoading ? <Loader2 className="animate-spin h-4 w-4" /> : undefined }
                    ]}
                >
                     <p className="text-stone-300">
                        Isso criará uma nova linha do tempo, independente da original. Você poderá explorar caminhos diferentes a partir deste exato momento. Deseja continuar?
                    </p>
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
