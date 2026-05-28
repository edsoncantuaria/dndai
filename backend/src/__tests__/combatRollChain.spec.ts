import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isCombatNarrationPhase } from '../combat/combatPhaseService.js';
import { rollResolutionShouldNarrate } from '../services/ruleResolutionService.js';

const SESSION_ID = 42;

const attackPending = {
    requestId: 'atk-chain-1',
    rollType: 'attack' as const,
    reason: 'Ataque',
    dice: '1d20',
    modifier: 5,
    metadata: {
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
    },
};

describe('combat roll chain (P0.4.4)', () => {
    it('cadeia attack → damage: shouldNarrate false no hit e true no dano', async () => {
        const { resolveStructuredRoll } = await import('../services/ruleResolutionService.js');
        const attackResult = await resolveStructuredRoll(SESSION_ID, attackPending, {
            total: 18,
            rawRoll: 13,
            diceValues: [13],
        });
        assert.ok(attackResult?.attackOutcome?.hit);
        assert.equal(attackResult?.shouldNarrate, false);
        assert.equal(
            rollResolutionShouldNarrate('attack', { hasDamageFollowUp: true }),
            false,
        );

        const followUp = attackResult?.nextRollRequest;
        assert.ok(followUp);
        assert.equal(followUp.request.rollType, 'damage');
        assert.equal(followUp.request.metadata?.effect, 'damage');
        assert.deepEqual(followUp.request.metadata?.targets, attackPending.metadata.targets);
        assert.equal(rollResolutionShouldNarrate('damage', {}), true);
    });

    it('ataque errado narra uma vez sem follow-up', async () => {
        const { resolveStructuredRoll } = await import('../services/ruleResolutionService.js');
        const result = await resolveStructuredRoll(SESSION_ID, attackPending, {
            total: 12,
            rawRoll: 7,
            diceValues: [7],
        });
        assert.equal(result?.attackOutcome?.hit, false);
        assert.equal(result?.shouldNarrate, true);
        assert.equal(
            rollResolutionShouldNarrate('attack', { hasDamageFollowUp: false }),
            true,
        );
        assert.equal(result?.nextRollRequest, undefined);
    });
});

describe('combat narration phase gate (P0.4.3)', () => {
    it('permite narração em RESOLVING e AWAITING_NARRATION', () => {
        assert.equal(isCombatNarrationPhase('RESOLVING'), true);
        assert.equal(isCombatNarrationPhase('AWAITING_NARRATION'), true);
        assert.equal(isCombatNarrationPhase('ROLL_PENDING'), false);
    });
});
