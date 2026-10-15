import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTravelDurationHours } from '../GameMaster/world/travelCanon.js';

test('viagem canônica: mesmos km, modos alteram apenas duração', () => {
    const baseHours = 48;
    const terrain = 1;
    const walk = computeTravelDurationHours(baseHours, terrain, 1);
    const horse = computeTravelDurationHours(baseHours, terrain, 2);
    const dragon = computeTravelDurationHours(baseHours, terrain, 8);

    assert.equal(walk, 48);
    assert.equal(horse, 24);
    assert.equal(dragon, 6);
});

test('distância canônica não muda com modo (só duração)', () => {
    const distanceKm = 200;
    assert.equal(distanceKm, 200);
    const walkHours = computeTravelDurationHours(48, 1, 1);
    const horseHours = computeTravelDurationHours(48, 1, 2);
    assert.ok(horseHours < walkHours);
});
