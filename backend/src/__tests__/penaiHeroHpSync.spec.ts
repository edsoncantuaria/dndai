import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { penaiIntegrationDescribe } from './helpers/penaiIntegrationDescribe.js';
import { createGameSession } from '../GameMaster/sessions/sessionService.js';
import { startPenaiCombat } from '../GameMaster/combat/engine.js';
import { loadHeroSessionStats, saveHeroSessionStats } from '../GameMaster/character/heroStats.js';
import { getSessionHeroEntityId } from '../GameMaster/character/heroStats.js';
import { syncHeroHpPenai } from '../GameMaster/character/syncHeroHp.js';
import { applyCharacterStateDeltaPenai } from '../GameMaster/character/applyStateDelta.js';
import { getPenaiCombatState } from '../GameMaster/combat/engine.js';
import { formatMechanicalPack } from '../GameMaster/character/formatMechanicalPack.js';

penaiIntegrationDescribe('penai hero HP single source (integration)', () => {
    it('delta no snapshot espelha SessionCombatant e mechanical pack', async () => {
        const created = await createGameSession({
            userId: 9201,
            nome: 'HP Sync',
            heroName: 'Paladino',
        });
        const sessionId = Number(created.id);
        await startPenaiCombat(sessionId, [
            {
                entityKey: 'enemy-1',
                displayName: 'Esqueleto',
                hpMax: 10,
                armorClass: 12,
            },
        ]);

        const heroId = await getSessionHeroEntityId(sessionId);
        assert.ok(heroId);

        await applyCharacterStateDeltaPenai(sessionId, { hp: { delta: -3 } });
        await syncHeroHpPenai(sessionId);

        const stats = await loadHeroSessionStats(sessionId, heroId!);
        const combat = await getPenaiCombatState(sessionId);
        const heroCombatant = combat.combatants.find(c => c.side === 'hero');
        const pack = await formatMechanicalPack(sessionId);
        const ch = pack.character as Record<string, unknown>;

        assert.equal(stats.hp, heroCombatant?.hp);
        assert.equal(ch.hp, stats.hp);
        assert.equal(ch.maxHp, stats.maxHp);
    });

    it('syncHeroHpPenai restaura espelho após mutação manual no snapshot', async () => {
        const created = await createGameSession({
            userId: 9202,
            nome: 'HP Restore',
            heroName: 'Clérigo',
        });
        const sessionId = Number(created.id);
        await startPenaiCombat(sessionId, [
            {
                entityKey: 'enemy-2',
                displayName: 'Zumbi',
                hpMax: 8,
                armorClass: 11,
            },
        ]);

        const heroId = await getSessionHeroEntityId(sessionId);
        const stats = await loadHeroSessionStats(sessionId, heroId!);
        stats.hp = Math.max(1, stats.hp - 5);
        await saveHeroSessionStats(sessionId, heroId!, stats);
        await syncHeroHpPenai(sessionId);

        const combat = await getPenaiCombatState(sessionId);
        const heroCombatant = combat.combatants.find(c => c.side === 'hero');
        assert.equal(heroCombatant?.hp, stats.hp);
    });
});

describe('penai hero HP (unit)', () => {
    it('syncHeroHpPenai exportado', async () => {
        assert.equal(typeof syncHeroHpPenai, 'function');
    });
});
