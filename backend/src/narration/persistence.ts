import { v4 as uuidv4 } from 'uuid';
import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import { Character } from '../entities/Character.js';
import type { GameMasterResponse } from '../schemas/gameSchemas.js';
import * as HomebrewService from '../services/homebrewService.js';
import * as SessaoService from '../services/sessaoService.js';
import redisClient from '../database/redis-client.js';
import { mergeCharacterUpdates } from '../services/safeMerge.js';
import {
    getInventorySnapshotFromDb,
    hydrateInventoryItems,
    reconcileCurrency,
} from '../services/inventoryService.js';
import {
    saveCombatEncounterState,
    type CombatReconciliationResult,
    type LoadedCombatEncounter,
} from '../services/combatStateService.js';
import { generateSceneImage, isImageGenerationAvailable } from '../services/imageGenerationService.js';
import { storeMemory } from '../services/vectorMemoryService.js';
import { shouldEmbedForOperation } from '../services/embeddingPolicy.js';
import { indexNewJournalEntries } from '../services/journalMemoryIndexer.js';
import { incrementStateVersion } from '../services/stateVersionService.js';
import { enforceWorldStateLocation } from './regionMapValidation.js';
import { prepareLogPayload } from './logPayload.js';
import { buildWorldStateSnapshot } from './worldStateSnapshot.js';
import { instrumentGameEvent } from '../services/gameEventInstrumentation.js';
import {
    type NarrationExecutionSource,
    isStaleBeforePersist,
    logStalePersistAbort,
    shouldSkipMechanicalPersistence,
} from './workerPersistencePolicy.js';

export interface PersistNarrationTurnParams {
    sessao: SessaoIA;
    userId: number;
    actionId?: string | null;
    apiKey: string;
    aiResponse: GameMasterResponse;
    playerAction: string;
    rawText: string | null;
    attempts: number;
    validationIssues: string[];
    usedFallback: boolean;
    latestStateHint: string | null;
    normalizedStateHints: unknown;
    isInternalAction: boolean;
    newStorySummaryForLog: string | null;
    combatReconciliation: CombatReconciliationResult | null;
    loadedCombat: LoadedCombatEncounter;
    motorOwnsState: boolean;
    latestNarrationSummary: string | null;
    sessionCacheKey: string;
    actionSequence?: number | null;
    /** P5.2 — `worker` não grava combate/mecânica; apenas append narrativo. */
    executionSource?: NarrationExecutionSource;
}

/** Transação de logs, homebrew, merge de personagem e memória vetorial (extraído de narrarService). */
export async function persistNarrationTurn(params: PersistNarrationTurnParams): Promise<GameMasterResponse> {
    const {
        sessao,
        userId,
        actionId,
        apiKey,
        aiResponse,
        playerAction,
        rawText,
        attempts,
        validationIssues,
        usedFallback,
        latestStateHint,
        normalizedStateHints,
        isInternalAction,
        newStorySummaryForLog,
        combatReconciliation,
        loadedCombat,
        motorOwnsState,
        latestNarrationSummary,
        sessionCacheKey,
        actionSequence,
        executionSource = 'sync',
    } = params;

    if (await isStaleBeforePersist(sessao.id, actionSequence)) {
        await logStalePersistAbort({
            sessionId: sessao.id,
            actionId,
            actionSequence,
            stage: 'pre_transaction',
        });
        return {
            ...aiResponse,
            stateVersion: sessao.stateVersion ?? undefined,
            actionSequence: actionSequence ?? undefined,
            systemLog: '[pipeline:narration-stale-abort]',
        };
    }

    const skipMechanicalWrites = shouldSkipMechanicalPersistence(motorOwnsState, executionSource);

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        if (actionId) {
            const { tryClaimNarrationPersistenceTx } = await import(
                '../services/narrationIdempotencyService.js'
            );
            const claimed = await tryClaimNarrationPersistenceTx(
                queryRunner.manager,
                sessao.id,
                actionId,
                actionSequence ?? null,
            );
            if (!claimed) {
                await queryRunner.rollbackTransaction();
                console.warn('[persistNarrationTurn] narração já persistida — skip', {
                    sessionId: sessao.id,
                    actionId,
                    actionSequence: actionSequence ?? null,
                });
                return {
                    ...aiResponse,
                    stateVersion: sessao.stateVersion ?? undefined,
                    actionSequence: actionSequence ?? undefined,
                };
            }
        }
        const logRepository = queryRunner.manager.getRepository(SessionLog);
        let persistedStateVersion: number | null = null;

        const persistSessionLog = async (
            logType: SessionLog['type'],
            promptLabel: string,
            payload: unknown,
            rollResult?: unknown,
        ) => {
            const response = await prepareLogPayload(sessao.id, logType, payload);
            if (!response) return;
            const log = new SessionLog();
            Object.assign(log, {
                sessaoId: sessao.id,
                prompt: promptLabel,
                response,
                type: logType,
                rollResult,
                stateVersion: persistedStateVersion,
            });
            await logRepository.save(log);
        };

        const trimmedRawText = typeof rawText === 'string' ? rawText.slice(0, 4000) : null;
        if (trimmedRawText) {
            await persistSessionLog('gm_raw', 'GM Raw Response', trimmedRawText);
        }
        await persistSessionLog('gm_validation', 'GM Validation', {
            attempts,
            issues: validationIssues,
            fallback: usedFallback,
        });
        if (trimmedRawText && (latestStateHint || validationIssues.length)) {
            await persistSessionLog('gm_discarded', 'GM Discarded Response', {
                rawText: trimmedRawText.slice(0, 4000),
                validationIssues,
                hints: normalizedStateHints,
            });
        }

        if (!isInternalAction) {
            await persistSessionLog('action', 'Player Action', playerAction);
        }

        const stateForLog: Partial<GameMasterResponse> = { ...aiResponse };
        delete stateForLog.logEntries;
        await persistSessionLog('state', 'GM Full State', stateForLog);

        if (newStorySummaryForLog) {
            await persistSessionLog('summary', 'Story Summary', newStorySummaryForLog);
        }

        if (!skipMechanicalWrites) {
            if (await isStaleBeforePersist(sessao.id, actionSequence)) {
                await logStalePersistAbort({
                    sessionId: sessao.id,
                    actionId,
                    actionSequence,
                    stage: 'pre_combat_save',
                });
                await queryRunner.rollbackTransaction();
                return {
                    ...aiResponse,
                    stateVersion: sessao.stateVersion ?? undefined,
                    actionSequence: actionSequence ?? undefined,
                    systemLog: '[pipeline:narration-stale-abort]',
                };
            }
            const canonicalStateToPersist = combatReconciliation?.canonicalState ?? null;
            if (canonicalStateToPersist || loadedCombat.encounterId !== null) {
                await saveCombatEncounterState(
                    queryRunner,
                    sessao.id,
                    loadedCombat.encounterId,
                    canonicalStateToPersist,
                );
            }
        }

        if (aiResponse.logEntries) {
            for (const entry of aiResponse.logEntries) {
                let contentToSave = entry.content;

                if (entry.type === 'image' && entry.content && typeof entry.content === 'object') {
                    const imageContent = entry.content as Record<string, unknown>;
                    if (imageContent.status === 'generating' && imageContent.prompt) {
                        if (!isImageGenerationAvailable(apiKey)) {
                            contentToSave = {
                                ...imageContent,
                                status: 'failed',
                                error: 'Serviço de geração de imagens indisponível no momento.',
                            };
                        } else {
                            try {
                                const generated = await generateSceneImage(
                                    imageContent.prompt as string,
                                    apiKey,
                                );
                                if (generated) {
                                    contentToSave = {
                                        ...imageContent,
                                        status: 'done',
                                        imageUrl: generated.url ?? imageContent.imageUrl,
                                        url: generated.url ?? imageContent.url,
                                        imageKey: generated.key,
                                        size: generated.size,
                                        contentType: generated.contentType,
                                        completedAt: new Date().toISOString(),
                                    };
                                } else {
                                    contentToSave = {
                                        ...imageContent,
                                        status: 'failed',
                                        error: 'Não foi possível gerar a imagem solicitada.',
                                    };
                                }
                            } catch (imageError: unknown) {
                                console.error('[persistence] Falha ao gerar imagem via Gemini:', imageError);
                                contentToSave = {
                                    ...imageContent,
                                    status: 'failed',
                                    error:
                                        imageError instanceof Error
                                            ? imageError.message
                                            : 'Falha desconhecida ao gerar imagem.',
                                };
                            }
                        }
                        entry.content = contentToSave;
                    }
                }

                await persistSessionLog(
                    entry.type || 'narration',
                    'GM Narration',
                    contentToSave,
                    entry.rollResult,
                );
            }
        }

        await enforceWorldStateLocation(sessao, aiResponse);

        if (
            aiResponse.newHomebrewContent &&
            Array.isArray(aiResponse.newHomebrewContent) &&
            !motorOwnsState
        ) {
            for (const newContent of aiResponse.newHomebrewContent) {
                try {
                    const existing = await HomebrewService.checkIfNameExists(newContent.name, newContent.type);
                    if (!existing) {
                        const saved = await HomebrewService.createHomebrewContent(userId, {
                            ...newContent,
                            isPublic: true,
                            createdBy: 'ai',
                        });
                        await SessaoService.updateHomebrewInstallation(sessao.id, userId, saved.id, 'install');
                        if (redisClient && redisClient.isOpen) {
                            await redisClient.del(sessionCacheKey);
                        }
                    }
                } catch (error) {
                    console.error('[persistence] Falha ao salvar conteúdo Homebrew da IA:', error);
                }
            }
        }

        if (!usedFallback) {
            const updatesFromAi = motorOwnsState
                ? ({} as Record<string, unknown>)
                : { ...(aiResponse.updatedCharacter || {}) };

            if (!motorOwnsState) {
                if (aiResponse.worldState) {
                    updatesFromAi.worldState = aiResponse.worldState;
                }
                if (aiResponse.gameClock) {
                    updatesFromAi.gameClock = {
                        ...((updatesFromAi.gameClock as Record<string, unknown>) || {}),
                        ...aiResponse.gameClock,
                    };
                }

                const hasWorldStateUpdates = Boolean(
                    updatesFromAi.worldState &&
                        Object.keys(updatesFromAi.worldState as object).length > 0,
                );
                const hasCharacterUpdates = Object.keys(updatesFromAi).some(key => key !== 'worldState');

                if (hasWorldStateUpdates || hasCharacterUpdates) {
                    console.log('[persistence] mergeCharacterUpdates payload', {
                        characterId: sessao.character!.id,
                        updates: updatesFromAi,
                    });
                    await mergeCharacterUpdates(sessao.character!.id, updatesFromAi, queryRunner);
                    if (redisClient && redisClient.isOpen) {
                        await redisClient.del(
                            `character:${sessao.character!.id}`,
                            `character:${sessao.character!.id}:optimized`,
                            sessionCacheKey,
                        );
                    }
                }
            }

            const canonicalInventory = await getInventorySnapshotFromDb(
                sessao.character!.id,
                queryRunner.manager,
            );
            console.log('[persistence] canonicalInventory snapshot', {
                characterId: sessao.character!.id,
                count: canonicalInventory.length,
            });
            const hydratedSnapshot = await hydrateInventoryItems(
                canonicalInventory,
                userId,
                canonicalInventory,
            );

            const persistedProgress = await queryRunner.manager.getRepository(Character).findOne({
                where: { id: sessao.character!.id },
                select: ['xp', 'level'],
                loadEagerRelations: false,
            });

            const canonicalPatch = {
                inventory: hydratedSnapshot.items as unknown[],
                currency: reconcileCurrency(
                    motorOwnsState ? undefined : aiResponse.updatedCharacter?.currency,
                    hydratedSnapshot.metrics.currency,
                ),
                currentWeight: hydratedSnapshot.metrics.totalWeight,
                totalCoinCount: hydratedSnapshot.metrics.totalCoinCount,
                xp: persistedProgress?.xp ?? (motorOwnsState ? undefined : aiResponse.updatedCharacter?.xp),
                level:
                    persistedProgress?.level ??
                    (motorOwnsState ? undefined : aiResponse.updatedCharacter?.level),
                gameClock: motorOwnsState ? undefined : updatesFromAi.gameClock,
            };
            console.log('[persistence] canonicalPatch aplicado', canonicalPatch);

            aiResponse.updatedCharacter = {
                ...(motorOwnsState ? {} : aiResponse.updatedCharacter || {}),
                ...canonicalPatch,
            };

            if (motorOwnsState && sessao.character) {
                const reloadedCharacter = await queryRunner.manager.getRepository(Character).findOne({
                    where: { id: sessao.character.id },
                });
                if (reloadedCharacter) {
                    aiResponse.worldState = buildWorldStateSnapshot(reloadedCharacter) as GameMasterResponse['worldState'];
                }
            }
        } else {
            aiResponse.updatedCharacter = undefined;
            aiResponse.worldState = undefined;
        }

        await queryRunner.commitTransaction();
        persistedStateVersion = await incrementStateVersion(sessao.id);
        aiResponse.stateVersion = persistedStateVersion;

        instrumentGameEvent(sessao.id, 'NarrationCompleted', {
            actionId: actionId ?? null,
            stateVersion: persistedStateVersion,
            characterId: sessao.characterId ?? null,
        });

        try {
            const { syncSessionCastFromWorld } = await import('../services/sessionCastService.js');
            await syncSessionCastFromWorld(sessao.id, userId, {
                combatState: aiResponse.combatState as { isActive?: boolean; combatants?: unknown[] } | null,
            });
        } catch (castSyncErr) {
            console.warn('[persistence] Falha ao sincronizar elenco da sessão:', castSyncErr);
        }

        const memoryLines = [
            `Jogador: ${playerAction}`,
            latestNarrationSummary ? `Mestre: ${latestNarrationSummary}` : null,
        ].filter(Boolean) as string[];

        const embedTurn = shouldEmbedForOperation(
            'store_turn',
            persistedStateVersion ?? 0,
            0,
        );

        try {
            await storeMemory(
                'session_memories',
                memoryLines.join('\n'),
                {
                    id: uuidv4(),
                    sessionId: String(sessao.id),
                    type: 'narration',
                    timestamp: Date.now(),
                    turn:
                        aiResponse.combatState?.turn ??
                        combatReconciliation?.canonicalState?.turn ??
                        0,
                    summary: latestNarrationSummary || playerAction.slice(0, 160),
                },
                apiKey,
                { embed: embedTurn, reason: 'turn_summary' },
            );
        } catch (error) {
            console.error('[persistence] Falha ao armazenar memória vetorial:', error);
        }

        if (sessao.character?.id) {
            try {
                const regionSlug =
                    (aiResponse.worldState as { regionSlug?: string } | undefined)?.regionSlug ??
                    (sessao.character.worldState as { regionSlug?: string } | undefined)?.regionSlug ??
                    null;
                await indexNewJournalEntries({
                    sessaoId: sessao.id,
                    characterId: sessao.character.id,
                    apiKey,
                    stateVersion: persistedStateVersion ?? 0,
                    regionSlug,
                });
            } catch (journalErr) {
                console.warn('[persistence] Falha ao indexar journal:', journalErr);
            }
        }

        if (sessao.id > 0) {
            const { refreshNarrativeSnapshotIfDue } = await import('../services/narrativeSnapshotService.js');
            void refreshNarrativeSnapshotIfDue({
                sessionId: sessao.id,
                character: sessao.character ?? null,
                characterForAI: (sessao.character ?? {}) as Record<string, unknown>,
                stateVersion: persistedStateVersion ?? sessao.stateVersion ?? 0,
            }).catch(err => {
                console.warn('[persistence] snapshot narrativo:', err);
            });
        }

        return aiResponse;
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error('Erro na transação de narração:', error);
        throw createError(500, 'Falha ao salvar o progresso da aventura.');
    } finally {
        await queryRunner.release();
    }
}
