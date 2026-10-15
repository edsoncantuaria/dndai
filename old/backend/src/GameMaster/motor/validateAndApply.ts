import { randomUUID } from 'crypto';
import { getGameSession } from '../sessions/sessionService.js';
import { applyTravelToSession } from '../world/travelCanon.js';
import { appendWorldEvent } from '../events/store.js';
import { classifyPenaiIntent } from './classifyIntent.js';
import { validateActionSense } from './actionSense.js';
import { validatePenaiCombatIntent, validatePenaiSkillIntent, validatePenaiSpellIntent } from './rulesBridge.js';
import { savePendingPenaiRoll } from './rollStore.js';
import {
    applyStructuredPenaiIntent,
    resolveStructuredIntentType,
    resolveStructuredPayload,
} from './structuredApply.js';
import { formatMechanicalPack } from '../character/formatMechanicalPack.js';
import type { PenaiMotorInput, PenaiMotorResult } from './types.js';
import { penaiPipelineLog, penaiPipelineWait } from '../infra/pipelineLog.js';
import { isSessionOpeningRequest } from '../ai/promptComposer.js';
import { inferSummonSpellFromText } from '../combat/summonCatalog.js';

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

async function resolvePenaiRollIntent(
    input: PenaiMotorInput,
    structuredType: string,
    payload: Record<string, unknown>,
): Promise<PenaiMotorResult | null> {
    const rollPayload = { ...resolveStructuredPayload(payload), structuredIntent: structuredType };
    let combat;
    if (structuredType === 'skill-check') {
        combat = await validatePenaiSkillIntent({
            sessionId: input.sessionId,
            playerAction: input.playerAction,
            payload: rollPayload,
        });
    } else if (structuredType === 'spell-attack') {
        combat = await validatePenaiSpellIntent({
            sessionId: input.sessionId,
            playerAction: input.playerAction,
            payload: rollPayload,
        });
    } else if (structuredType === 'weapon-attack') {
        combat = await validatePenaiCombatIntent({
            sessionId: input.sessionId,
            playerAction: input.playerAction,
            payload: rollPayload,
        });
    } else {
        return null;
    }

    const intent = { type: 'combat' as const, payload: rollPayload };

    await appendWorldEvent({
        type: 'COMBAT_ACTION_REQUESTED',
        sessionId: input.sessionId,
        payload: {
            actionId: input.actionId,
            playerAction: input.playerAction,
            status: combat.ruleCheck.status,
            structuredIntent: structuredType,
        },
    });

    if (combat.ruleCheck.status === 'rejected') {
        return {
            intent,
            ruleCheck: combat.ruleCheck,
            mechanical: { intentType: structuredType },
            blocked: true,
            awaitingRoll: false,
        };
    }

    const rollReq =
        combat.playerRollRequest ??
        (combat.ruleCheck.status === 'needs_roll'
            ? {
                  reason: input.playerAction.slice(0, 120),
                  dice: '1d20',
                  modifier: 0,
                  rollType: 'attack' as const,
                  requestId: randomUUID(),
              }
            : null);

    if (rollReq) {
        const stored = await savePendingPenaiRoll({
            sessionId: input.sessionId,
            userId: input.userId,
            actionId: input.actionId,
            actionSequence: input.actionSequence,
            playerAction: input.playerAction,
            roll: rollReq,
        });
        return {
            intent,
            ruleCheck: combat.ruleCheck,
            mechanical: {
                intentType: structuredType,
                rollRequired: true,
                playerRollRequest: stored,
            },
            blocked: false,
            awaitingRoll: true,
            playerRollRequest: stored,
        };
    }

    return {
        intent,
        ruleCheck: combat.ruleCheck,
        mechanical: { intentType: structuredType },
        blocked: false,
        awaitingRoll: false,
    };
}

export async function validateAndApply(input: PenaiMotorInput): Promise<PenaiMotorResult> {
    const ctx = {
        sessionId: input.sessionId,
        userId: input.userId,
        actionId: input.actionId,
        actionSequence: input.actionSequence,
    };
    penaiPipelineLog('MOTOR', 'validateAndApply início', { playerAction: input.playerAction.slice(0, 120) }, ctx);

    const session = await getGameSession(input.sessionId);
    if (!session) {
        return {
            intent: { type: 'free', payload: {} },
            ruleCheck: { status: 'rejected', reason: 'Sessão não encontrada.' },
            mechanical: {},
            blocked: true,
            awaitingRoll: false,
        };
    }

    const payload = input.payload ?? {};

    const {
        isSessionHeroDead,
        isSessionEnded,
        getHeroVitals,
        tryOfferDeathSaveRoll,
    } = await import('../character/heroVitalsService.js');
    const { heroCanTakeActions } = await import('../../rules/deathSaves.js');

    if (await isSessionEnded(input.sessionId)) {
        return {
            intent: { type: 'free', payload: {} },
            ruleCheck: { status: 'rejected', reason: 'Esta campanha terminou — o herói não sobreviveu.' },
            mechanical: { intentType: 'hero_dead', code: 'HERO_DEAD' },
            blocked: true,
            awaitingRoll: false,
        };
    }

    const heroStats = await getHeroVitals(input.sessionId);
    if (heroStats?.heroStatus === 'dead' || (await isSessionHeroDead(input.sessionId))) {
        return {
            intent: { type: 'free', payload: {} },
            ruleCheck: { status: 'rejected', reason: 'O herói está morto — não há mais ações possíveis.' },
            mechanical: { intentType: 'hero_dead', code: 'HERO_DEAD' },
            blocked: true,
            awaitingRoll: false,
        };
    }

    if (isSessionOpeningRequest(input.playerAction, payload)) {
        penaiPipelineLog('MOTOR', 'abertura de sessão — bypass actionSense', {}, ctx);
        const mechanical = await formatMechanicalPack(input.sessionId);
        return {
            intent: { type: 'free', payload: { opening: true, bootstrap: true } },
            ruleCheck: { status: 'accepted', reason: 'Abertura cinematográfica da sessão.' },
            mechanical: { ...mechanical, intentType: 'opening' },
            blocked: false,
            awaitingRoll: false,
        };
    }

    if (heroStats && !heroCanTakeActions({
        hp: heroStats.hp,
        maxHp: heroStats.maxHp,
        heroStatus: heroStats.heroStatus,
        deathSaves: heroStats.deathSaves,
        conditions: heroStats.conditions,
    })) {
        const deathRoll = await tryOfferDeathSaveRoll(input.sessionId, input.userId, {
            actionId: input.actionId,
            actionSequence: input.actionSequence,
        });
        if (deathRoll) {
            const stored = await savePendingPenaiRoll({
                sessionId: input.sessionId,
                userId: input.userId,
                actionId: input.actionId,
                actionSequence: input.actionSequence,
                playerAction: 'Teste de morte',
                roll: deathRoll,
            });
            const mechanical = await formatMechanicalPack(input.sessionId);
            return {
                intent: { type: 'free', payload: { deathSave: true } },
                ruleCheck: { status: 'needs_roll', reason: 'Teste de morte obrigatório.' },
                mechanical: {
                    ...mechanical,
                    intentType: 'death-save',
                    playerRollRequest: stored,
                },
                blocked: false,
                awaitingRoll: true,
                playerRollRequest: stored,
            };
        }
        return {
            intent: { type: 'free', payload: {} },
            ruleCheck: {
                status: 'rejected',
                reason:
                    heroStats.heroStatus === 'stable'
                        ? 'Você está estável e inconsciente — aguarde cura ou ajuda.'
                        : 'Você está inconsciente e não pode agir.',
            },
            mechanical: { intentType: 'unconscious', heroStatus: heroStats.heroStatus },
            blocked: true,
            awaitingRoll: false,
        };
    }

    const structuredType = resolveStructuredIntentType(payload);
    if (structuredType) {
        const rollTypes = ['weapon-attack', 'skill-check', 'spell-attack'];
        if (rollTypes.includes(structuredType)) {
            if (structuredType === 'spell-attack') {
                const spellIndex = String(
                    payload.spellIndex ?? payload.spell ?? resolveStructuredPayload(payload).spellIndex ?? '',
                ).trim();
                if (spellIndex) {
                    const { assertResourceAllowedForSession } = await import(
                        '../homebrew/moduleResolver.js'
                    );
                    const hb = await assertResourceAllowedForSession(
                        input.sessionId,
                        'spell',
                        spellIndex,
                    );
                    if (!hb.allowed) {
                        return {
                            intent: { type: 'combat', payload },
                            ruleCheck: { status: 'rejected', reason: hb.reason ?? 'Magia não permitida.' },
                            mechanical: { intentType: structuredType },
                            blocked: true,
                            awaitingRoll: false,
                        };
                    }
                }
            }
            const rollResult = await resolvePenaiRollIntent(input, structuredType, payload);
            if (rollResult) return rollResult;
        }
        const structured = await applyStructuredPenaiIntent({
            sessionId: input.sessionId,
            userId: input.userId,
            playerAction: input.playerAction,
            actionId: input.actionId,
            actionSequence: input.actionSequence,
            intentType: structuredType,
            payload: resolveStructuredPayload(payload),
        });
        if (structured) return structured;
    }

    const inferredSummon = inferSummonSpellFromText(input.playerAction);
    if (inferredSummon) {
        const structured = await applyStructuredPenaiIntent({
            sessionId: input.sessionId,
            userId: input.userId,
            playerAction: input.playerAction,
            actionId: input.actionId,
            actionSequence: input.actionSequence,
            intentType: 'summon-spell',
            payload: { spellIndex: inferredSummon },
        });
        if (structured) return structured;
    }

    penaiPipelineWait('ACTION_SENSE', 'validando plausibilidade…', ctx);
    const sense = await validateActionSense({
        sessionId: input.sessionId,
        userId: input.userId,
        playerAction: input.playerAction,
        payload,
    });
    penaiPipelineLog(
        'ACTION_SENSE',
        sense.ok ? 'ok' : 'rejeitado',
        { reason: sense.reason, hint: sense.hint },
        ctx,
    );
    if (!sense.ok) {
        return {
            intent: { type: 'free', payload: {} },
            ruleCheck: { status: 'rejected', reason: sense.reason },
            mechanical: {
                intentType: 'invalid',
                hint: sense.hint ?? null,
            },
            blocked: true,
            awaitingRoll: false,
        };
    }

    const intent = sense.refinedIntent ?? classifyPenaiIntent(input.playerAction, payload);
    const currentRegionSlug = (session.currentRegionSlug as string | null) ?? null;

    if (intent.type === 'travel') {
        if (!intent.payload.targetRegionSlug) {
            return {
                intent,
                ruleCheck: { status: 'rejected', reason: 'Destino de viagem não informado.' },
                mechanical: { intentType: 'travel' },
                blocked: true,
                awaitingRoll: false,
            };
        }
        const applied = await applyTravelToSession({
            sessionId: input.sessionId,
            fromRegionSlug: currentRegionSlug,
            payload: intent.payload,
            actionId: input.actionId,
            actionSequence: input.actionSequence,
        });
        return {
            intent,
            ruleCheck: applied.result,
            mechanical: {
                intentType: 'travel',
                currentRegionSlug: applied.ok
                    ? slugify(intent.payload.targetRegionSlug)
                    : currentRegionSlug,
                travel: applied.travel ?? null,
            },
            blocked: !applied.ok,
            awaitingRoll: false,
        };
    }

    if (intent.type === 'combat') {
        const isSkill =
            intent.payload.structuredIntent === 'skill-check' && intent.payload.skillIndex;
        const combat = isSkill
            ? await validatePenaiSkillIntent({
                  sessionId: input.sessionId,
                  playerAction: input.playerAction,
                  payload: intent.payload,
              })
            : await validatePenaiCombatIntent({
                  sessionId: input.sessionId,
                  playerAction: input.playerAction,
                  payload: intent.payload,
              });

        await appendWorldEvent({
            type: 'COMBAT_ACTION_REQUESTED',
            sessionId: input.sessionId,
            payload: {
                actionId: input.actionId,
                playerAction: input.playerAction,
                status: combat.ruleCheck.status,
            },
        });

        if (combat.ruleCheck.status === 'rejected') {
            return {
                intent,
                ruleCheck: combat.ruleCheck,
                mechanical: { intentType: 'combat' },
                blocked: true,
                awaitingRoll: false,
            };
        }

        const rollReq =
            combat.playerRollRequest ??
            (combat.ruleCheck.status === 'needs_roll'
                ? {
                      reason: input.playerAction.slice(0, 120),
                      dice: '1d20',
                      modifier: 0,
                      rollType: 'attack' as const,
                      requestId: randomUUID(),
                  }
                : null);

        if (rollReq) {
            const stored = await savePendingPenaiRoll({
                sessionId: input.sessionId,
                userId: input.userId,
                actionId: input.actionId,
                actionSequence: input.actionSequence,
                playerAction: input.playerAction,
                roll: rollReq,
            });
            return {
                intent,
                ruleCheck: combat.ruleCheck,
                mechanical: {
                    intentType: 'combat',
                    rollRequired: true,
                    playerRollRequest: stored,
                },
                blocked: false,
                awaitingRoll: true,
                playerRollRequest: stored,
            };
        }

        return {
            intent,
            ruleCheck: combat.ruleCheck,
            mechanical: { intentType: 'combat' },
            blocked: false,
            awaitingRoll: false,
        };
    }

    const pack = await formatMechanicalPack(input.sessionId);
    return {
        intent,
        ruleCheck: { status: 'accepted', reason: 'Ação livre aceita.' },
        mechanical: { intentType: intent.type, ...pack },
        blocked: false,
        awaitingRoll: false,
    };
}
