import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { ensurePenaiTestDb } from './helpers/penaiTestDb.js';
import { createGameSession } from '../GameMaster/sessions/sessionService.js';
import { startPenaiCombat, getPenaiCombatState } from '../GameMaster/combat/engine.js';
import { normalizePenaiCombatPhase } from '../GameMaster/combat/phaseGate.js';

const dbDescribe = process.env.DATABASE_URL ? describe : describe.skip;

dbDescribe('penai combat FSM (integration)', () => {
    before(async () => {
        const ok = await ensurePenaiTestDb();
        if (!ok) throw new Error('PostgreSQL indisponível');
    });

    it('startPenaiCombat persiste iniciativa d20 e fases canônicas', async () => {
        const created = await createGameSession({
            userId: 9101,
            nome: 'Combate FSM',
            heroName: 'Guerreiro',
        });
        const sessionId = Number(created.id);

        await startPenaiCombat(sessionId, [
            {
                entityKey: 'enemy-goblin-1',
                displayName: 'Goblin',
                hpMax: 7,
                armorClass: 13,
            },
        ]);

        const state = await getPenaiCombatState(sessionId);
        assert.equal(state.isActive, true);
        assert.equal(normalizePenaiCombatPhase(state.phase), 'TURN_START');
        assert.ok(state.initiativeOrder.length >= 2);
        assert.ok(state.combatants.every(c => typeof c.initiative === 'number'));
    });

    it('advancePenaiCombatTurn avança índice de turno', async () => {
        const created = await createGameSession({
            userId: 9102,
            nome: 'Turn Advance',
            heroName: 'Mago',
        });
        const sessionId = Number(created.id);
        await startPenaiCombat(sessionId, [
            {
                entityKey: 'enemy-orc-1',
                displayName: 'Orc',
                hpMax: 15,
                armorClass: 14,
            },
        ]);

        const { advancePenaiCombatTurn } = await import('../GameMaster/combat/engine.js');
        const before = await getPenaiCombatState(sessionId);
        await advancePenaiCombatTurn(sessionId);
        const after = await getPenaiCombatState(sessionId);

        const expectedTurn = before.turn + 1 >= before.initiativeOrder.length ? 0 : before.turn + 1;
        assert.equal(after.turn, expectedTurn);
    });
});

describe('penai combat FSM (unit)', () => {
    it('normalizePenaiCombatPhase mapeia aliases legados', async () => {
        const { normalizePenaiCombatPhase } = await import(
            '../GameMaster/combat/phaseGate.js'
        );
        assert.equal(normalizePenaiCombatPhase('ACTIVE'), 'ENCOUNTER_ACTIVE');
        assert.equal(normalizePenaiCombatPhase('ENDED'), 'ENCOUNTER_END');
    });
});
