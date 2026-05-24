// src/components/GameContainer.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import SettingsModal from './SettingsModal';
import SystemTestModal from './system/SystemTestModal';
import * as GameService from '@/services/gameService';
import { ApiError } from '@/services/apiClient';
import type { Character, SessaoIA } from '@/types';
import ActionModal from './ui/ActionModal';
import { useAuth } from '@/contexts/AuthContext';
import ArchitectureHelpModal from './system/ArchitectureHelpModal';
import { loadTranslations } from '@/utils/translator';
import type { SessionFactsResponse } from '@/services/gameService';
import { useToast } from '@/hooks/use-toast';
import { isUiV2Enabled } from '@/lib/uiV2';
import { StageTransition } from '@/components/motion/StageTransition';
import { AmbientAudioEngine } from '@/components/AmbientAudioEngine';
import { useStageAmbientSound } from '@/hooks/useStageAmbientSound';
import { useMenuMusicCrossfade } from '@/hooks/useMenuMusicCrossfade';
import { consumeHubIntent } from '@/lib/hubIntentStorage';
import { setHubBackTarget } from '@/lib/hubSession';
import type { HubIntent } from '@/contexts/HubIntentContext';
import { useHubNavigation } from '@/contexts/HubNavigationContext';
import GameMenuContent from './game-menu/GameMenuContent';
import { GameStage } from '@/types/gameStage';
import { Loader2 } from 'lucide-react';
import Game from './Game';
import ErrorModal from './ui/ErrorModal';


const GameContainer = () => {
    const {
        character,
        loadGameSession,
        clearGameState,
        deleteCharacter,
        deleteSession,
        apiError,
        clearApiError,
    } = useGameStateContext();

    const { useAiHomebrew, playMenuMusic, volume, isMuted } = useSettingsContext();
    const { logout, user } = useAuth();
    const { toast } = useToast();
    const hubNavigation = useHubNavigation();

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
    const [selectedSessionForAction, setSelectedSessionForAction] = useState<SessaoIA | null>(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);


    const onSetStage = (stage: GameStage) => setGameStage(stage);

    useStageAmbientSound(gameStage);
    useMenuMusicCrossfade({ gameStage, playMenuMusic, volume, isMuted });

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
        if (gameStage === 'loading' || gameStage === 'main_menu' || gameStage === 'session_list' || gameStage === 'character_vault') {
            fetchInitialData();
        }
    }, [gameStage, fetchInitialData]);

    useEffect(() => {
        if (!isLoadingData && gameStage === 'loading') {
            setGameStage('main_menu');
        }
    }, [isLoadingData, gameStage]);

    const handleNewGameFromVault = useCallback(async (char: Character, existingSession?: SessaoIA) => {
        setGameStage('playing');
        try {
            const sessionId = existingSession?.id;
            if (sessionId) {
                await loadGameSession(sessionId);
                return;
            }
            const { sessao } = await GameService.createGameSession(`Aventura de ${char.name}`, char.id);
            if (sessao) {
                await loadGameSession(sessao.id);
            } else {
                throw new Error('Failed to create a new session from the server.');
            }
        } catch (error) {
            console.error('[GameContainer] Failed to start new game session:', error);
            const message =
                error instanceof ApiError
                    ? error.message
                    : error instanceof Error
                      ? error.message
                      : 'Não foi possível iniciar a aventura.';
            toast({
                variant: 'destructive',
                title: 'Falha ao abrir a mesa',
                description: message,
            });
            setGameStage('character_vault');
        }
    }, [loadGameSession, toast]);
    
    const handleCharacterCreated = () => {
        setGameStage('character_vault');
        fetchInitialData();
    };

    const handleContinueGame = useCallback(async (sessionIdToLoad: number) => {
        setGameStage('playing');
        const loadedData = await loadGameSession(sessionIdToLoad);
        if (!loadedData) {
            setGameStage('main_menu');
        }
    }, [loadGameSession]);

    const applyHubIntent = useCallback(
        (intent: HubIntent) => {
            setHubBackTarget('landing');
            switch (intent.type) {
                case 'continue':
                    void handleContinueGame(intent.sessionId);
                    break;
                case 'session_list':
                    setGameStage('session_list');
                    break;
                case 'character_vault':
                    setGameStage('character_vault');
                    break;
                case 'creating_character':
                    setGameStage('creating_character');
                    break;
                case 'homebrew_store':
                    setGameStage('homebrew_store');
                    break;
                case 'translation_studio':
                    setGameStage('translation_studio');
                    break;
            }
        },
        [handleContinueGame]
    );

    useEffect(() => {
        if (!isUiV2Enabled() || isLoadingData || gameStage !== 'main_menu') return;
        const intent = consumeHubIntent();
        if (intent) applyHubIntent(intent);
    }, [isLoadingData, gameStage, applyHubIntent]);

    const returnToMenu = useCallback(() => {
        clearGameState();
        setGameStage('main_menu');
    }, [clearGameState]);

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
            const response = await GameService.cloneGameSession(sessionToClone.id);
            if (response?.sessao) {
                toast({ title: 'Aventura Clonada!', description: 'Uma nova linha do tempo foi criada com sucesso.' });
                fetchInitialData();
            } else {
                throw new Error("A resposta da clonagem não continha os dados da sessão.");
            }
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
    
    const openSessionActionModal = (session: SessaoIA) => {
        setSelectedSessionForAction(session);
        setIsActionModalOpen(true);
    };

    const handleActionModalClose = () => {
        setIsActionModalOpen(false);
        setSelectedSessionForAction(null);
    };

    const openSettings = useCallback(() => setShowSettingsModal(true), []);
    const openSystemTests = useCallback(() => setShowTestModal(true), []);
    const openArchitecture = useCallback(() => setShowArchitectureModal(true), []);
    const handleOpenSettingsFromError = useCallback(() => {
        clearApiError();
        setShowSettingsModal(true);
    }, [clearApiError]);

    const shouldPromptApiKey = Boolean(
        apiError &&
        (apiError.toLowerCase().includes('chave da api') || apiError.toLowerCase().includes('api key'))
    );

    useEffect(() => {
        const handler = () => setShowSettingsModal(true);
        window.addEventListener('game-open-settings', handler as EventListener);
        return () => {
            window.removeEventListener('game-open-settings', handler as EventListener);
        };
    }, []);

    const menuContent = (
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
                onReturnToHubLanding={hubNavigation?.returnToHubLanding}
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
                isActionModalOpen={isActionModalOpen}
                selectedSessionForAction={selectedSessionForAction}
                handleActionModalClose={handleActionModalClose}
                openSessionActionModal={openSessionActionModal}
            />
    );

    return (
        <>
            {isUiV2Enabled() ? (
                <StageTransition stageKey={gameStage}>{menuContent}</StageTransition>
            ) : (
                menuContent
            )}

            {isUiV2Enabled() ? <AmbientAudioEngine /> : null}

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
                    title={`Excluir Sessão "${sessionToDelete.nome}"?`}
                    onClose={() => setSessionToDelete(null)}
                    actions={[
                        { text: 'Cancelar', onClick: () => setSessionToDelete(null), variant: 'secondary' },
                        { text: 'Confirmar Exclusão', onClick: confirmDeleteSession, variant: 'destructive' }
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
                        { text: "Sim, Criar Linha do Tempo", onClick: confirmCloneSession, variant: 'primary', disabled: isActionLoading, icon: isActionLoading ? <Loader2 className="animate-spin h-4 w-4" /> : undefined }
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

            {apiError && (
                <ErrorModal
                    message={apiError}
                    onClose={clearApiError}
                    actionLabel={shouldPromptApiKey ? 'Abrir Configurações' : undefined}
                    onAction={shouldPromptApiKey ? handleOpenSettingsFromError : undefined}
                />
            )}
        </>
    );
};

export default GameContainer;
