import { buildNarrativeContextPack } from '../memory/narrativePack.js';
import { defaultProviders } from '../adapters/index.js';
import { assertNarrationPtBr } from '../locale/narrationGuard.js';
import { appendWorldEvent } from '../events/store.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { storeSessionMemory, storeWorldMemory } from '../memory/store.js';
import { maybeScheduleMemoryCompaction } from '../memory/narrativeMemory.js';
import { formatMechanicalPack } from '../character/formatMechanicalPack.js';
import { buildContextualActionOptions } from '../motor/contextualActionOptions.js';
import { publishWsToUser } from '../transport/wsPubSub.js';
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
} from '../combat/phaseGate.js';

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

/** Orquestrador enxuto: pack → narrate → persist → WS → complete turn. */
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

    maybeScheduleMemoryCompaction({
        sessionId: input.sessionId,
        actionSequence: input.actionSequence,
    });

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
        const out = await defaultProviders.narration.render(pack, {
            userApiKey: userApiKey ?? undefined,
        });
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
    await appendWorldEvent({
        type: 'TURN_NARRATED',
        sessionId: input.sessionId,
        payload: { actionId: input.actionId, actionSequence: input.actionSequence },
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
        entries: [{ timestamp: timeLabel, content: narration, tone, consequences: [] }],
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
