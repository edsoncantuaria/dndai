import { buildNarrativeContextPack } from '../memory/narrativePack.js';
import { renderNarrationPtBr } from '../ai/geminiClient.js';
import { assertNarrationPtBr } from '../locale/narrationGuard.js';
import { appendWorldEvent } from '../events/store.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { storeSessionMemory, storeWorldMemory } from '../memory/store.js';
import { formatMechanicalPack } from '../character/formatMechanicalPack.js';
import { buildContextualActionOptions } from '../motor/contextualActionOptions.js';
import { publishWsToUser } from '../transport/wsPubSub.js';
import { findEntityCandidates, findOrReuseNpcEntity, markEntityAppeared } from '../world/entityRegistry.js';
import { startMemoryCompactionWorkflow } from '../../temporal/client.js';
import { completePenaiTurnNarration } from '../motor/turnLock.js';
import {
    resolveInferenceApiKey,
    consumePlatformNarrationCredit,
    isPlatformBillingEnabled,
} from '../../services/aiBillingService.js';
import {
    shouldAllowPenaiCombatNarration,
    advancePenaiCombatPhaseAfterNarration,
    getActivePenaiCombatPhase,
} from '../combat/combatPhasePenai.js';

export type TurnPipelineInput = {
    sessionId: number;
    userId: number;
    playerAction: string;
    actionSequence: number;
    actionId: string;
    rollSummary?: string;
    motorHints?: string[];
};

export type TurnPipelineResult = {
    narration: string;
    tone?: string;
    actionOptions: Array<{ id: string; label: string }>;
};

export async function runTurnPipeline(input: TurnPipelineInput): Promise<TurnPipelineResult> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: input.sessionId },
    });
    if (!session) throw new Error('Sessão não encontrada');

    const narrationAllowed = await shouldAllowPenaiCombatNarration(input.sessionId);
    if (!narrationAllowed) {
        await appendWorldEvent({
            type: 'COMBAT_NARRATION_DEFERRED',
            sessionId: input.sessionId,
            payload: {
                actionId: input.actionId,
                actionSequence: input.actionSequence,
                phase: await getActivePenaiCombatPhase(input.sessionId),
            },
        });
        await completePenaiTurnNarration(input.sessionId, input.actionSequence);
        return { narration: '', actionOptions: [] };
    }

    const pack = await buildNarrativeContextPack({
        sessionId: input.sessionId,
        playerAction: input.playerAction,
        regionSlug: session.currentRegionSlug,
        rollSummary: input.rollSummary,
        motorHints: input.motorHints,
    });

    const candidates = await findEntityCandidates({
        regionSlug: session.currentRegionSlug ?? undefined,
        limit: 3,
    });
    if (candidates[0]) {
        await markEntityAppeared(input.sessionId, candidates[0].id, { level: 1 });
    } else if (/npc|encontr|falar com/i.test(input.playerAction)) {
        const reused = await findOrReuseNpcEntity({
            displayName: 'Viajante',
            createdByUserId: input.userId,
        });
        await markEntityAppeared(input.sessionId, reused.id, { level: 1 });
    }

    if (input.actionSequence > 0 && input.actionSequence % 8 === 0) {
        void startMemoryCompactionWorkflow({
            sessionId: input.sessionId,
            fromActionSequence: Math.max(0, input.actionSequence - 8),
            toActionSequence: input.actionSequence,
        });
    }

    const userApiKey = await resolveInferenceApiKey(input.userId);
    if (isPlatformBillingEnabled()) {
        const ok = await consumePlatformNarrationCredit(input.userId);
        if (!ok) {
            await publishWsToUser(input.userId, {
                type: 'error',
                contractVersion: 2,
                sessionId: input.sessionId,
                message: 'Créditos de IA esgotados.',
                locale: 'pt-BR',
            });
            await completePenaiTurnNarration(input.sessionId, input.actionSequence);
            return { narration: '', actionOptions: [] };
        }
    }

    let narration = '';
    let tone: string | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
        const out = await renderNarrationPtBr({ contextPack: pack, userApiKey: userApiKey ?? undefined });
        const guard = assertNarrationPtBr(out.narration);
        if (guard.ok) {
            narration = out.narration;
            tone = out.tone;
            break;
        }
        if (attempt === 2) {
            narration =
                'O vento leva o silêncio por um instante; algo na cena pede sua próxima decisão.';
            tone = 'neutral';
        }
    }

    await storeSessionMemory({
        sessionId: input.sessionId,
        text: narration,
        actionSequence: input.actionSequence,
    });

    await appendWorldEvent({
        type: 'NARRATION_COMPLETED',
        sessionId: input.sessionId,
        payload: { actionId: input.actionId, actionSequence: input.actionSequence, tone },
        canonCandidate: true,
    });
    void storeWorldMemory({
        sessionId: input.sessionId,
        text: narration,
        regionSlug: session.currentRegionSlug,
    }).catch(() => undefined);

    const mechanical = await formatMechanicalPack(input.sessionId);
    const actionOptions = Array.isArray(mechanical.actionOptions)
        ? mechanical.actionOptions
        : buildContextualActionOptions({ domain: 'exploration' });

    const timeLabel = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });

    await publishWsToUser(input.userId, {
        type: 'storyFeed',
        contractVersion: 2,
        sessionId: input.sessionId,
        actionId: input.actionId,
        actionSequence: input.actionSequence,
        locale: 'pt-BR',
        entries: [
            {
                timestamp: timeLabel,
                content: narration,
                tone,
                consequences: [],
            },
        ],
    });

    await publishWsToUser(input.userId, {
        type: 'gameStateUpdate',
        contractVersion: 2,
        sessionId: input.sessionId,
        actionId: input.actionId,
        actionSequence: input.actionSequence,
        payload: {
            logEntries: [{ type: 'narrative', content: narration, tone }],
            actionOptions,
        },
    });

    await completePenaiTurnNarration(input.sessionId, input.actionSequence);
    await advancePenaiCombatPhaseAfterNarration(input.sessionId);

    await publishWsToUser(input.userId, {
        type: 'narrationComplete',
        contractVersion: 2,
        sessionId: input.sessionId,
        actionId: input.actionId,
        actionSequence: input.actionSequence,
        locale: 'pt-BR',
        payload: {
            logEntries: [{ type: 'narrative', content: narration, tone }],
            actionOptions,
        },
    });

    return { narration, tone, actionOptions };
}
