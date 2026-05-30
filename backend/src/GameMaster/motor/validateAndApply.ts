import { randomUUID } from 'crypto';
import { getGameSession } from '../sessions/sessionService.js';
import { applyTravelToSession } from '../world/travelCanon.js';
import { appendWorldEvent } from '../events/store.js';
import { classifyPenaiIntent } from './classifyIntent.js';
import { validateActionSense } from './actionSense.js';
import { validatePenaiCombatIntent, validatePenaiSkillIntent, validatePenaiSpellIntent } from './rulesBridge.js';
import { savePendingPenaiRoll } from './penaiRollStore.js';
import {
    applyStructuredPenaiIntent,
    resolveStructuredIntentType,
    resolveStructuredPayload,
} from './structuredApply.js';
import { formatMechanicalPack } from '../character/formatMechanicalPack.js';
import type { PenaiMotorInput, PenaiMotorResult } from './types.js';

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

    const sense = await validateActionSense({
        sessionId: input.sessionId,
        userId: input.userId,
        playerAction: input.playerAction,
        payload,
    });
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
