import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    canTransitionCombatPhase,
    COMBAT_PHASES,
    type CombatPhase,
} from '../combat/combatPhase.js';

describe('combatPhase FSM', () => {
    it('expõe fases conhecidas', () => {
        assert.ok(COMBAT_PHASES.includes('AWAITING_NARRATION'));
        assert.ok(COMBAT_PHASES.includes('ROLL_PENDING'));
    });

    it('permite attack → roll pending → narration', () => {
        const chain: CombatPhase[] = [
            'ACTION_DECLARED',
            'ROLL_PENDING',
            'RESOLVING',
            'AWAITING_NARRATION',
            'TURN_END',
        ];
        for (let i = 0; i < chain.length - 1; i++) {
            assert.equal(
                canTransitionCombatPhase(chain[i], chain[i + 1]),
                true,
                `${chain[i]} → ${chain[i + 1]}`,
            );
        }
    });

    it('bloqueia IDLE → AWAITING_NARRATION direto', () => {
        assert.equal(canTransitionCombatPhase('IDLE', 'AWAITING_NARRATION'), false);
    });
});
