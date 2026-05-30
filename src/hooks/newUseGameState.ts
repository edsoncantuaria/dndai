// src/hooks/newUseGameState.ts — orquestrador (F.2: slices session / narration / combat)
'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useInteractionManager } from './useInteractionManager';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { useGameSession } from './game/useGameSession';
import {
    useGameActionPipelineRefs,
    useGameCombatSlice,
    useGameNarrationSlice,
    useGameSessionSlice,
} from './game/slices';
import { buildBuyItemIntent, buildSellItemIntent, buildOpenShopIntent } from './game/motorIntents';
import type { StructuredIntent } from './game/motorIntents';
import { getPenaiBridge } from '@/lib/penaiBridge';
import { translateAttribute } from '@/utils/translator';
import type { InventoryItem, LevelUpSelections, PlayerRollRequest, ShopItem } from '../types';

export const useNewGameState = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    const session = useGameSessionSlice();
    const pipelineRefs = useGameActionPipelineRefs();
    const interactionState = useInteractionManager();
    const combat = useGameCombatSlice(interactionState);

    const narration = useGameNarrationSlice({
        pipelineRefs,
        hasPendingRoll: Boolean(interactionState.playerRollRequest),
    });

    const getApiKey = useCallback(() => '', []);

    const sendMotorAction = useCallback(
        (playerAction: string, structured?: StructuredIntent) => {
            const bridge = getPenaiBridge();
            if (!bridge?.active) {
                toast({
                    variant: 'destructive',
                    title: 'Motor não conectado',
                    description: 'Aguarde a conexão com a sessão ou reabra a aventura.',
                });
                return;
            }
            interactionState.clearTransientInteractions();
            interactionState.setActionOptions([]);
            narration.setActionPhaseLabel('Aguarde o Mestre…');
            narration.setIsLoading(true);
            if (structured) {
                bridge.sendStructuredIntent(structured, playerAction);
            } else {
                bridge.sendProcessAction(playerAction);
            }
        },
        [interactionState, narration, toast],
    );

    const submitRollResult = useCallback(
        (request: PlayerRollRequest, result: { rawRoll: number; rolls: number[] }) => {
            const bridge = getPenaiBridge();
            if (!bridge?.submitRollResult) {
                toast({
                    variant: 'destructive',
                    title: 'Motor não conectado',
                    description: 'Não foi possível enviar o resultado da rolagem.',
                });
                return;
            }
            narration.setActionPhaseLabel('Resolvendo rolagem…');
            narration.setIsLoading(true);
            bridge.submitRollResult(request, result);
        },
        [narration, toast],
    );

    const sessionApi = useGameSession({
        user: user as { id?: number; installedHomebrewIds?: number[] } | null,
        sessionId: session.sessionId,
        character: session.character,
        ambientSound: session.ambientSound,
        setCharacter: session.setCharacter,
        setSessionId: session.setSessionId,
        setAmbientSound: session.setAmbientSound,
        setApiError: narration.setApiError,
        setIsLoading: narration.setIsLoading,
        setProgressionFeed: session.setProgressionFeed,
        logState: narration.logState,
        interactionState,
        clientStateVersionRef: pipelineRefs.clientStateVersionRef,
        lastLogVersionRef: pipelineRefs.lastLogVersionRef,
        resetActionPipeline: narration.resetActionPipeline,
        toast,
    });

    const isRollPending = Boolean(interactionState.playerRollRequest);

    useEffect(() => {
        if (interactionState.playerRollRequest) {
            narration.setActionPhaseLabel('Aguardando sua rolagem...');
        } else if (pipelineRefs.pendingActionsRef.current.size === 0) {
            narration.setActionPhaseLabel(prev => (prev?.includes('rolagem') ? null : prev));
        }
    }, [interactionState.playerRollRequest, narration.setActionPhaseLabel, pipelineRefs.pendingActionsRef]);

    useEffect(() => {
        if (session.sessionId) {
            pipelineRefs.latestActionSequenceRef.current = 0;
            narration.resetActionPipeline(null);
        }
    }, [session.sessionId, narration.resetActionPipeline, pipelineRefs.latestActionSequenceRef]);

    const applyLevelUp = useCallback(
        async (selections: LevelUpSelections) => {
            if (!session.character || !interactionState.levelUpState?.isPending) return;

            const { newLevel } = interactionState.levelUpState;
            const summaryParts: string[] = [];

            if (selections.attributes) {
                const attrChanges = Object.entries(selections.attributes)
                    .filter(([, value]) => !!value)
                    .map(([attr, value]) => `${translateAttribute(attr)} +${value}`);
                if (attrChanges.length) summaryParts.push(`Atributos: ${attrChanges.join(', ')}`);
            }
            if (selections.spells?.length) summaryParts.push(`Novas magias: ${selections.spells.join(', ')}`);
            if (selections.featureChoices?.length) {
                const featSummary = selections.featureChoices
                    .map(choice => choice.selections.join(', '))
                    .filter(Boolean);
                if (featSummary.length) summaryParts.push(`Características: ${featSummary.join('; ')}`);
            }
            if (selections.subclass) summaryParts.push(`Subclasse: ${selections.subclass}`);
            if (selections.hpIncrease !== undefined) {
                summaryParts.push(`Aumento de PV total: +${selections.hpIncrease}`);
            }

            const actionText = [
                `Confirmo meu avanço para o nível ${newLevel}.`,
                summaryParts.length ? summaryParts.join(' | ') : '',
            ]
                .filter(Boolean)
                .join(' ');

            interactionState.clearRequest('levelUp');
            interactionState.setActionOptions([]);
            sendMotorAction(actionText, {
                type: 'apply-level-up',
                payload: {
                    newLevel,
                    attributes: selections.attributes,
                    spells: selections.spells,
                    hpIncrease: selections.hpIncrease,
                    subclass: selections.subclass,
                    featureChoices: selections.featureChoices,
                },
            });
        },
        [session.character, interactionState, sendMotorAction],
    );

    const toggleEquipped = useCallback(
        (itemId: string) => {
            const item = session.character?.inventory.find(i => String(i.id) === String(itemId));
            if (!item) return;

            const actionText = item.equipped ? `Eu desequipo meu ${item.name}.` : `Eu equipo meu ${item.name}.`;
            const numericId = Number(itemId);
            if (Number.isFinite(numericId)) {
                sendMotorAction(actionText, {
                    type: 'equip-item',
                    payload: { itemId: numericId, equipped: !item.equipped },
                });
            } else {
                sendMotorAction(actionText);
            }
        },
        [session.character, sendMotorAction],
    );

    const useConsumable = useCallback(
        (itemId: string) => {
            const item = session.character?.inventory.find(i => i.id === itemId);
            if (!item || !item.consumable) {
                toast({ variant: 'destructive', title: 'Item não consumível' });
                return;
            }
            sendMotorAction(`Eu uso ${item.name}.`);
        },
        [session.character, sendMotorAction, toast],
    );

    const spendHitDice = useCallback(
        (diceCount: number) => {
            if (!session.character || session.character.hitDice.current < diceCount) return;
            sendMotorAction(`Eu gasto ${diceCount} dado(s) de vida para me curar.`);
        },
        [session.character, sendMotorAction],
    );

    const declineHitDiceRequest = useCallback(() => {
        interactionState.clearRequest('hitDice');
        toast({
            title: 'Sem descanso agora',
            description: 'Os Dados de Vida continuam disponíveis para a próxima pausa.',
        });
        sendMotorAction('Eu não vou gastar dados de vida agora.');
    }, [interactionState, sendMotorAction, toast]);

    const takeLoot = useCallback(
        (takeAll: boolean) => {
            if (!interactionState.pendingLootOffer || !takeAll) return;
            sendMotorAction('Eu pego todo o tesouro.', { type: 'claim-loot', payload: {} });
        },
        [interactionState.pendingLootOffer, sendMotorAction],
    );

    const buyItem = useCallback(
        (item: ShopItem, price: number) => {
            sendMotorAction(`Compro ${item.name}.`, buildBuyItemIntent(item));
        },
        [sendMotorAction],
    );

    const openShop = useCallback(
        (catalog: { name: string; inventory: ShopItem[]; merchantName?: string }) => {
            sendMotorAction(
                `Entro em ${catalog.name}.`,
                buildOpenShopIntent(catalog.name, catalog.inventory, catalog.merchantName),
            );
        },
        [sendMotorAction],
    );

    const closeShop = useCallback(() => {
        sendMotorAction('Saio da loja.', { type: 'close-shop', payload: {} });
    }, [sendMotorAction]);

    return useMemo(
        () => ({
            character: session.character,
            log: narration.logState.log,
            sessionId: session.sessionId,
            actionOptions: interactionState.actionOptions,
            setActionOptions: interactionState.setActionOptions,
            skillCheckRequest: interactionState.skillCheckRequest,
            setSkillCheckRequest: interactionState.setSkillCheckRequest,
            spellCastRequest: interactionState.spellCastRequest,
            setSpellCastRequest: interactionState.setSpellCastRequest,
            pendingStructuredIntent: interactionState.pendingStructuredIntent,
            setPendingStructuredIntent: interactionState.setPendingStructuredIntent,
            setRequest: interactionState.setRequest,
            clearRequest: interactionState.clearRequest,
            setPlayerRollRequest: interactionState.setPlayerRollRequest,
            handleSkillCheck: interactionState.handleSkillCheck,
            getTestShopCatalog: interactionState.getTestShopCatalog,
            triggerTestSkillCheck: interactionState.triggerTestSkillCheck,
            ...combat,
            reinstallModal: { open: false, deps: [], onConfirm: () => {} },
            setReinstallModal: () => {},
            isLoading: narration.isLoading,
            apiError: narration.apiError,
            ambientSound: session.ambientSound,
            setAmbientSound: session.setAmbientSound,
            progressionFeed: session.progressionFeed,
            clearApiError: narration.clearApiError,
            getApiKey,
            createCharacter: sessionApi.createCharacter,
            deleteCharacter: sessionApi.deleteCharacter,
            deleteSession: sessionApi.deleteSession,
            startGame: sessionApi.startGame,
            sendMotorAction,
            clearGameState: sessionApi.clearGameState,
            loadGameSession: sessionApi.loadGameSession,
            handleRollResult: interactionState.handleRollResult(submitRollResult),
            handleSkillCheckSubmit: interactionState.handleSkillCheckSubmit(sendMotorAction),
            submitSpellCast: interactionState.submitSpellCast(sendMotorAction),
            applyLevelUp,
            toggleEquipped,
            useConsumable,
            spendHitDice,
            declineHitDiceRequest,
            takeLoot,
            buyItem,
            sellItem: (item: InventoryItem, price: number) => {
                sendMotorAction(`Vendo ${item.name}.`, buildSellItemIntent(item, price));
            },
            openShop,
            closeShop,
            startEncounter: combat.handleStartEncounter(sendMotorAction),
            nextTurn: combat.nextTurn(sendMotorAction),
            triggerTestShop: (motorAction?: (action: string) => void) =>
                combat.triggerTestShop(motorAction ?? sendMotorAction),
            triggerTestCombat: (
                motorAction?: (action: string) => void,
                charOverride?: { id: number; name: string; attributes?: { hp?: number; maxHp?: number; ac?: number } },
            ) => {
                const c =
                    charOverride ??
                    (session.character
                        ? {
                              id: session.character.id,
                              name: session.character.name,
                              attributes: session.character.attributes,
                          }
                        : undefined);
                combat.triggerTestCombat(motorAction ?? sendMotorAction, c);
            },
            setCharacter: session.setCharacter,
            setLog: narration.logState.setLog,
            setSessionId: session.setSessionId,
            actionPhaseLabel: narration.actionPhaseLabel,
            isRollPending,
            turnPipelinePhase: narration.turnPipelinePhase,
        }),
        [
            session,
            narration,
            interactionState,
            combat,
            sessionApi,
            applyLevelUp,
            toggleEquipped,
            useConsumable,
            spendHitDice,
            declineHitDiceRequest,
            takeLoot,
            buyItem,
            openShop,
            closeShop,
            sendMotorAction,
            submitRollResult,
            getApiKey,
            isRollPending,
        ],
    );
};
