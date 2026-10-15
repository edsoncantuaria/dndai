import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { penaiIntegrationDescribe } from './helpers/penaiIntegrationDescribe.js';
import { listGameSessions, createGameSession, getGameSession } from '../GameMaster/sessions/sessionService.js';
import { formatMechanicalPack } from '../GameMaster/character/formatMechanicalPack.js';

penaiIntegrationDescribe('penai lobby v2 (integration)', () => {
    it('createGameSession + listGameSessions retorna sessão do usuário', async () => {
        const userId = 9001;
        const created = await createGameSession({
            userId,
            nome: 'Lobby Test',
            heroName: 'Aragorn',
        });
        const sessionId = Number(created.id);
        assert.ok(Number.isFinite(sessionId));

        const listed = await listGameSessions(userId);
        assert.ok(listed.some(s => Number(s.id) === sessionId));

        const fetched = await getGameSession(sessionId);
        assert.ok(fetched);
        assert.equal(fetched?.nome, 'Lobby Test');
        assert.equal(fetched?.engine, 'penai');
    });

    it('formatMechanicalPack inclui character HP e combatState IDLE', async () => {
        const created = await createGameSession({
            userId: 9002,
            nome: 'Mechanical Shape',
            heroName: 'Legolas',
        });
        const sessionId = Number(created.id);
        const pack = await formatMechanicalPack(sessionId);

        assert.ok(pack.character);
        const ch = pack.character as Record<string, unknown>;
        assert.ok(typeof ch.hp === 'number');
        assert.ok(typeof ch.maxHp === 'number');
        assert.ok(Array.isArray(ch.inventory));

        const combat = pack.combatState as Record<string, unknown>;
        assert.equal(combat.isActive, false);
        assert.equal(combat.phase, 'IDLE');
    });
});

describe('penai lobby v2 (unit)', () => {
    it('listGameSessions exportado do sessionService', async () => {
        assert.equal(typeof listGameSessions, 'function');
    });
});
