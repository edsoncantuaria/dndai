import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldAllowPenaiCombatNarration, isPenaiCombatNarrationPhase } from '../GameMaster/combat/phaseGate.js';

describe('penai narration gate (unit)', () => {
    it('isPenaiCombatNarrationPhase bloqueia ROLL_PENDING', () => {
        assert.equal(isPenaiCombatNarrationPhase('ROLL_PENDING'), false);
        assert.equal(isPenaiCombatNarrationPhase('RESOLVING'), true);
    });

    it('shouldAllowPenaiCombatNarration retorna true sem sessão DB', async () => {
        const allowed = await shouldAllowPenaiCombatNarration(999999);
        assert.equal(allowed, true);
    });
});
