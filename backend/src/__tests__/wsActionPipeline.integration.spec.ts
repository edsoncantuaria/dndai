import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Integração WS: skill-check → needs_roll → bloqueio de nova intent (Fase 7.3).
 */
test('skill-check needs_roll bloqueia nova ação até limpar fila', async t => {
    process.env.REDIS_URL = 'mock';
    const { createProcessActionIntent } = await import('../services/actionService.js');
    const rollRequestService = await import('../services/rollRequestService.js');
    rollRequestService.__rollRequestTestHooks.useMemoryOnly();
    t.after(() => rollRequestService.__rollRequestTestHooks.reset());

    let stateVersion = 0;
    const deps = {
        validateAndPersistActionCursor: async () => null,
        heartbeatSessionLeaseOrThrow: async () => {},
        loadStateVersion: async () => stateVersion,
        getPendingRollRequest: rollRequestService.getPendingRollRequest,
        validateActionIntent: async () => ({
            result: {
                status: 'needs_roll',
                rollRequest: {
                    formula: '1d20+3',
                    context: 'Percepção passiva',
                    modifierBreakdown: ['SAB +1', 'Prof +2'],
                    targetDc: 13,
                },
                authoritativeSignature: 'rules:skill-check',
            },
        }),
        savePendingRollRequest: rollRequestService.savePendingRollRequest,
        applyResultingStateDelta: async () => ({
            appliedDelta: {},
            metrics: { damage: 0, healing: 0, spellSlotsUsed: 0, restType: undefined },
            updatedCharacter: {},
            updatedEntities: [],
        }),
        incrementStateVersion: async () => ++stateVersion,
        logAppliedDelta: async () => {},
        recordDamage: () => {},
        recordHealing: () => {},
        recordSpellSlotUse: () => {},
        recordRestMetric: () => {},
        beginActionPhase: async () => {},
        advanceActionPhase: async () => {},
        clearActionPhase: async () => {},
    };

    const processActionIntent = createProcessActionIntent(deps);
    const sessionId = 9001;
    const userId = 42;

    const first = await processActionIntent({
        sessionId,
        userId,
        body: {
            intent: { type: 'skill-check', payload: { skill: 'perception', dc: 13 } },
            clientStateVersion: 0,
            actionId: 'ws-skill-1',
        },
    });

    assert.equal(first.actionResolution.status, 'needs_roll');
    assert.equal(first.actionResolution.rule, 'skill-check');
    assert.ok(first.gameStateUpdate.playerRollRequest);

    const head = await rollRequestService.__rollRequestTestHooks.peekQueueHead(sessionId);
    assert.equal(head?.rollId, first.actionResolution.rollRequest?.requestId);

    await assert.rejects(
        () =>
            processActionIntent({
                sessionId,
                userId,
                body: {
                    intent: { type: 'skill-check', payload: { skill: 'perception', dc: 10 } },
                    clientStateVersion: 0,
                },
            }),
        /Há rolagens pendentes/,
    );
});
