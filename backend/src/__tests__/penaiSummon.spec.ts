import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    SUMMON_SPELLS,
    SUMMON_TEMPLATES,
    inferSummonSpellFromText,
    isSummonSpellIndex,
} from '../GameMaster/combat/summonCatalog.js';

describe('summonCatalog', () => {
    it('identifica magias de invocação suportadas', () => {
        assert.equal(isSummonSpellIndex('animate-dead'), true);
        assert.equal(isSummonSpellIndex('conjure-animals'), true);
        assert.equal(isSummonSpellIndex('fireball'), false);
    });

    it('infere magia a partir do texto livre em português', () => {
        assert.equal(inferSummonSpellFromText('Conjuro animar mortos no cadáver'), 'animate-dead');
        assert.equal(inferSummonSpellFromText('Invoco um lobo para me ajudar'), 'conjure-animals');
        assert.equal(inferSummonSpellFromText('Ataco o goblin'), null);
    });

    it('templates têm stats mínimos de combate', () => {
        for (const key of Object.values(SUMMON_SPELLS).flatMap(c => c.templateKeys)) {
            const t = SUMMON_TEMPLATES[key];
            assert.ok(t, `template ${key}`);
            assert.ok(t.hpMax > 0);
            assert.ok(t.ac >= 8);
        }
    });
});
