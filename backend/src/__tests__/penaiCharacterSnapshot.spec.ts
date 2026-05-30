import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHeroSessionStats, defaultHeroSessionStats } from '../GameMaster/character/heroStats.js';

test('defaultHeroSessionStats tem HP e moedas', () => {
    const s = defaultHeroSessionStats(1);
    assert.ok(s.hp > 0);
    assert.equal(s.hp, s.maxHp);
    assert.ok(s.coins.gp >= 0);
});

test('parseHeroSessionStats mescla snapshot parcial', () => {
    const s = parseHeroSessionStats({ hp: 5, maxHp: 10 });
    assert.equal(s.hp, 5);
    assert.equal(s.maxHp, 10);
});
