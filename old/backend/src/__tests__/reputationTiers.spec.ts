import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreToReputationTier } from '../GameMaster/world/reputationTiers.js';
import {
    getFactionCatalogEntry,
    isCatalogFaction,
} from '../GameMaster/world/factionCatalog.js';

test('scoreToReputationTier mapeia faixas', () => {
    assert.equal(scoreToReputationTier(0).id, 'neutral');
    assert.equal(scoreToReputationTier(-80).id, 'despised');
    assert.equal(scoreToReputationTier(25).id, 'respected');
    assert.equal(scoreToReputationTier(60).id, 'renowned');
});

test('catálogo de facções rejeita slug arbitrário', () => {
    assert.equal(isCatalogFaction('guilda-aventureiros'), true);
    assert.equal(isCatalogFaction('guilda-inventada-runtime'), false);
    assert.ok(getFactionCatalogEntry('gremio-sombra')?.archetype === 'guild_thieves');
});
