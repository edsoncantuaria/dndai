import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFactTierFromCategory } from '../services/sessionFactTtl.js';

describe('sessionFactTtl (P2.3)', () => {
    it('mapeia categorias para tiers', () => {
        assert.equal(resolveFactTierFromCategory('general'), 'ephemeral');
        assert.equal(resolveFactTierFromCategory('quest'), 'persistent');
        assert.equal(resolveFactTierFromCategory('npc'), 'scene');
        assert.equal(resolveFactTierFromCategory('region'), 'scene');
    });
});
