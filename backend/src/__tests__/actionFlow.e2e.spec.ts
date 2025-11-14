import test from 'node:test';
import assert from 'node:assert/strict';

test('processActionIntent integrates roll queue lifecycle end-to-end', async t => {
    process.env.REDIS_URL = 'mock';
    const { createProcessActionIntent } = await import('../services/actionService.js');
    const rollRequestService = await import('../services/rollRequestService.js');
    rollRequestService.__rollRequestTestHooks.useMemoryOnly();
    t.after(() => {
        rollRequestService.__rollRequestTestHooks.reset();
    });

    let stateVersion = 0;
    let intentCall = 0;

    const deps = {
        validateAndPersistActionCursor: async () => null,
        heartbeatSessionLeaseOrThrow: async () => {},
        loadStateVersion: async () => stateVersion,
        getPendingRollRequest: rollRequestService.getPendingRollRequest,
        validateActionIntent: async () => {
            intentCall += 1;
            if (intentCall === 1) {
                return {
                    result: {
                        status: 'needs_roll',
                        rollRequest: {
                            formula: '1d20+4',
                            context: 'Ataque com espada longa',
                            modifierBreakdown: ['FOR +2', 'Proficiência +2'],
                            targetDc: 15,
                            advantage: false,
                            disadvantage: false,
                            metadata: { effect: 'attack', damageFormula: '1d8+2' },
                        },
                        data: { hint: 'roll-required' },
                        stateDelta: { pendingAttack: { damageFormula: '1d8+2' } },
                        authoritativeSignature: 'rules:test',
                    },
                };
            }
            return {
                result: {
                    status: 'accepted',
                    stateDelta: {
                        character: { hp: { delta: -3 } },
                    },
                    authoritativeSignature: 'rules:test',
                },
            };
        },
        savePendingRollRequest: rollRequestService.savePendingRollRequest,
        applyResultingStateDelta: async (_sessionId: number, stateDelta: any) => ({
            appliedDelta: stateDelta,
            metrics: { damage: 0, healing: 0, spellSlotsUsed: 0, restType: undefined },
            updatedCharacter: { id: 'char-1' },
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
    const sessionId = 321;
    const userId = 11;

    const first = await processActionIntent({
        sessionId,
        userId,
        body: {
            intent: { type: 'weapon-attack', payload: { weaponIndex: 'longsword', targetArmorClass: 14 } },
            clientStateVersion: 0,
            actionId: 'needs-roll-action',
        },
    });
    assert.equal(first.actionResolution.status, 'needs_roll');
    assert.ok(first.gameStateUpdate.playerRollRequest);
    const head = await rollRequestService.__rollRequestTestHooks.peekQueueHead(sessionId);
    assert.equal(head?.rollId, first.actionResolution.rollRequest?.requestId);

    await assert.rejects(
        () =>
            processActionIntent({
                sessionId,
                userId,
                body: {
                    intent: { type: 'weapon-attack', payload: { weaponIndex: 'longsword', targetArmorClass: 12 } },
                    clientStateVersion: 0,
                },
            }),
        /Há rolagens pendentes/
    );

    await rollRequestService.clearPendingRollRequest(sessionId);
    const second = await processActionIntent({
        sessionId,
        userId,
        body: {
            intent: { type: 'weapon-attack', payload: { weaponIndex: 'longsword', targetArmorClass: 12 } },
            clientStateVersion: 0,
            actionId: 'accepted-action',
        },
    });
    assert.equal(second.actionResolution.status, 'accepted');
    assert.equal(second.actionResolution.stateVersion, 1);
    const queueEmpty = await rollRequestService.__rollRequestTestHooks.peekQueueHead(sessionId);
    assert.equal(queueEmpty, null);
});

test('stateVersion increments monotonically across accepted intents', async t => {
    process.env.REDIS_URL = 'mock';
    const { createProcessActionIntent } = await import('../services/actionService.js');
    const rollRequestService = await import('../services/rollRequestService.js');
    rollRequestService.__rollRequestTestHooks.useMemoryOnly();
    t.after(() => {
        rollRequestService.__rollRequestTestHooks.reset();
    });

    let stateVersion = 0;
    const deps = {
        validateAndPersistActionCursor: async () => null,
        heartbeatSessionLeaseOrThrow: async () => {},
        loadStateVersion: async () => stateVersion,
        getPendingRollRequest: rollRequestService.getPendingRollRequest,
        validateActionIntent: async () => ({
            result: {
                status: 'accepted',
                stateDelta: {
                    character: { hp: { delta: -1 } },
                },
                authoritativeSignature: 'rules:test',
            },
        }),
        savePendingRollRequest: rollRequestService.savePendingRollRequest,
        applyResultingStateDelta: async (_sessionId: number, stateDelta: any) => ({
            appliedDelta: stateDelta,
            metrics: { damage: 1, healing: 0, spellSlotsUsed: 0, restType: undefined },
            updatedCharacter: { id: 'char-1', hp: { current: 9, max: 12 } },
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
    const sessionId = 777;
    const userId = 22;

    const first = await processActionIntent({
        sessionId,
        userId,
        body: {
            intent: { type: 'weapon-attack', payload: { weaponIndex: 'spear', targetArmorClass: 11 } },
            clientStateVersion: 0,
        },
    });
    assert.equal(first.actionResolution.stateVersion, 1);
    const second = await processActionIntent({
        sessionId,
        userId,
        body: {
            intent: { type: 'weapon-attack', payload: { weaponIndex: 'spear', targetArmorClass: 10 } },
            clientStateVersion: 1,
        },
    });
    assert.equal(second.actionResolution.stateVersion, 2);
    const queueHead = await rollRequestService.__rollRequestTestHooks.peekQueueHead(sessionId);
    assert.equal(queueHead, null);
});
