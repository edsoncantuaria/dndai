import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { levelFromXp } from '../GameMaster/character/xp.js';

describe('penai hero vault (unit)', () => {
    it('levelFromXp segue tabela SRD básica', () => {
        assert.equal(levelFromXp(0), 1);
        assert.equal(levelFromXp(300), 2);
        assert.equal(levelFromXp(900), 3);
    });
});

describe('penai hero vault exports', () => {
    it('heroVaultPenai exporta funções principais', async () => {
        const mod = await import('../GameMaster/character/vault.js');
        assert.equal(typeof mod.createVaultHero, 'function');
        assert.equal(typeof mod.listVaultHeroes, 'function');
        assert.equal(typeof mod.cloneVaultHeroToSession, 'function');
    });
});
