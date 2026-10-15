import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    rollResolutionShouldNarrate,
    buildDamageFollowUp,
    resolveAttackRollCore,
} from '../rules/rollResolutionCore.js';

const attackMetadata = {
    effect: 'attack' as const,
    damageFormula: '1d8+3',
    source: { name: 'Espada longa' },
    targets: [
        {
            kind: 'entity' as const,
            id: 'goblin-1',
            name: 'Goblin',
            armorClass: 15,
            encounterId: 1,
        },
    ],
};

describe('penai roll chain core', () => {
    it('hit gera follow-up de dano e shouldNarrate false', () => {
        const core = resolveAttackRollCore(
            { context: { actionId: 'a1', intentType: 'attack' }, requestId: 'r1' },
            attackMetadata,
            18,
        );
        assert.equal(core.hit, true);
        assert.equal(core.shouldNarrate, false);
        assert.ok(core.nextRollRequest);
        assert.equal(core.nextRollRequest?.request.rollType, 'damage');
        assert.equal(
            rollResolutionShouldNarrate('attack', { hasDamageFollowUp: true }),
            false,
        );
    });

    it('miss narra uma vez sem follow-up', () => {
        const core = resolveAttackRollCore(
            { context: { actionId: 'a1' }, requestId: 'r1' },
            attackMetadata,
            10,
        );
        assert.equal(core.hit, false);
        assert.equal(core.shouldNarrate, true);
        assert.equal(core.nextRollRequest, undefined);
    });

    it('buildDamageFollowUp preserva targets', () => {
        const follow = buildDamageFollowUp({ requestId: 'r1' }, attackMetadata);
        assert.ok(follow);
        assert.equal(follow?.request.metadata?.effect, 'damage');
        assert.deepEqual(follow?.request.metadata?.targets, attackMetadata.targets);
    });
});

describe('penai combat narration phases', () => {
    it('isPenaiCombatNarrationPhase reconhece RESOLVING e AWAITING_NARRATION', async () => {
        const { isPenaiCombatNarrationPhase } = await import(
            '../GameMaster/combat/phaseGate.js'
        );
        assert.equal(isPenaiCombatNarrationPhase('RESOLVING'), true);
        assert.equal(isPenaiCombatNarrationPhase('AWAITING_NARRATION'), true);
        assert.equal(isPenaiCombatNarrationPhase('ROLL_PENDING'), false);
    });

    it('normalizePenaiCombatPhase mapeia ACTIVE → ENCOUNTER_ACTIVE', async () => {
        const { normalizePenaiCombatPhase } = await import(
            '../GameMaster/combat/phaseGate.js'
        );
        assert.equal(normalizePenaiCombatPhase('ACTIVE'), 'ENCOUNTER_ACTIVE');
        assert.equal(normalizePenaiCombatPhase('ENDED'), 'ENCOUNTER_END');
    });
});

describe('penai roll pipeline deferNarration', () => {
    it('resolvePenaiRoll emite deferNarration quando há follow-up (sem DB)', async () => {
        const { savePendingPenaiRoll, clearPendingPenaiRoll } = await import(
            '../GameMaster/motor/rollStore.js'
        );
        const sessionId = 88001;
        await clearPendingPenaiRoll(sessionId);

        await savePendingPenaiRoll({
            sessionId,
            userId: 1,
            actionId: 'act-1',
            actionSequence: 1,
            playerAction: 'Ataco o goblin',
            roll: {
                requestId: 'roll-1',
                reason: 'Ataque',
                dice: '1d20',
                modifier: 5,
                rollType: 'attack',
                metadata: attackMetadata,
            },
        });

        const { resolvePenaiRoll } = await import('../GameMaster/motor/rollPipeline.js');
        let result;
        try {
            result = await resolvePenaiRoll({
                sessionId,
                userId: 1,
                requestId: 'roll-1',
                rolls: [15],
            });
        } catch (err) {
            await clearPendingPenaiRoll(sessionId);
            if (
                err instanceof Error &&
                err.name === 'EntityMetadataNotFoundError'
            ) {
                return;
            }
            throw err;
        }

        assert.equal(result.ok, true);
        assert.equal(result.deferNarration, true);
        assert.ok(result.playerRollRequest);
        assert.equal(result.playerRollRequest?.rollType, 'damage');

        await clearPendingPenaiRoll(sessionId);
    });
});
