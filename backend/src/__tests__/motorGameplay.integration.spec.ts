import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCombatAutoEnd } from '../services/combatMotorService.js';
import { validateStartEncounterIntent } from '../rules/combatEncounterMotor.js';
import { validateQuestCompleteIntent } from '../rules/questMotor.js';
import { validateBuyItemIntent, validateOpenShopIntent } from '../rules/shopMotor.js';

test('validateStartEncounterIntent exige jogador e inimigos', () => {
    const ok = validateStartEncounterIntent(null, {
        combatants: [
            { id: 'player', name: 'Herói', hp: 20, maxHp: 20, isPlayer: true },
            { id: 'orc', name: 'Orc', hp: 10, maxHp: 10, attitude: 'hostile' },
        ],
    });
    assert.equal(ok.status, 'accepted');

    const bad = validateStartEncounterIntent({ isActive: true } as any, {
        combatants: [{ id: 'orc', name: 'Orc', hp: 10, maxHp: 10 }],
    });
    assert.equal(bad.status, 'rejected');
});

test('evaluateCombatAutoEnd encerra sem hostis', () => {
    const state = {
        isActive: true,
        round: 1,
        turn: 0,
        initiativeOrder: ['player'],
        log: [],
        combatants: [
            {
                id: 'player',
                name: 'Herói',
                hp: { current: 10, max: 20 },
                isPlayer: true,
                attitude: 'ally' as const,
                conditions: [],
                hasMoved: false,
                hasActed: false,
                isDead: false,
                actionPoints: 3,
                bonusActionPoints: 1,
                rollHistory: [],
                cooldowns: [],
                statusEffects: [],
            },
            {
                id: 'goblin',
                name: 'Goblin',
                hp: { current: 0, max: 7 },
                isPlayer: false,
                attitude: 'hostile' as const,
                conditions: [],
                hasMoved: false,
                hasActed: false,
                isDead: true,
                actionPoints: 0,
                bonusActionPoints: 0,
                rollHistory: [],
                cooldowns: [],
                statusEffects: [],
            },
        ],
    };
    const result = evaluateCombatAutoEnd(state);
    assert.equal(result.ended, true);
    assert.equal(result.state.isActive, false);
});

test('validateQuestCompleteIntent bloqueia em combate', () => {
    const r = validateQuestCompleteIntent({ isActive: true } as any, { description: 'test' });
    assert.equal(r.status, 'rejected');
    const ok = validateQuestCompleteIntent(null, { questLevel: 3 });
    assert.equal(ok.status, 'accepted');
});

test('validateOpenShopIntent e buyItem', () => {
    const open = validateOpenShopIntent({ isActive: true } as any, { inventory: [{ id: '1' }] });
    assert.equal(open.status, 'rejected');
    const shop = validateOpenShopIntent(null, {
        inventory: [{ id: 'potion', name: 'Poção', cost: { quantity: 10, unit: 'gp' } }],
    });
    assert.equal(shop.status, 'accepted');
    const buy = validateBuyItemIntent({ itemId: 'potion', priceGp: 10 });
    assert.equal(buy.status, 'accepted');
});
