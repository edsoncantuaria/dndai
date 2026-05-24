import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    evaluateCombatAutoEnd,
    mergeClientHostileHpHints,
} from '../services/combatMotorService.js';
import { buildCombatVictoryLoot } from '../services/lootMotorService.js';
import { assertShopAllowedDuringCombat } from '../services/shopMotorService.js';
import { enforceNarrativeOnlyResponse } from '../ai/narrativeContract.js';

describe('motorGuards', () => {
    it('encerra combate quando não há hostis vivos', () => {
        const state = {
            isActive: true,
            round: 2,
            turn: 0,
            initiativeOrder: ['player', 'goblin'],
            log: [],
            combatants: [
                {
                    id: 'player',
                    name: 'Herói',
                    hp: { current: 20, max: 20 },
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

    it('rejeita aumento de PV de hostil via cliente', () => {
        const stored = {
            isActive: true,
            round: 1,
            turn: 0,
            initiativeOrder: ['player', 'orc'],
            log: [],
            combatants: [
                {
                    id: 'player',
                    name: 'Herói',
                    hp: { current: 20, max: 20 },
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
                    id: 'orc',
                    name: 'Orc',
                    hp: { current: 5, max: 15 },
                    isPlayer: false,
                    attitude: 'hostile' as const,
                    conditions: [],
                    hasMoved: false,
                    hasActed: false,
                    isDead: false,
                    actionPoints: 0,
                    bonusActionPoints: 0,
                    rollHistory: [],
                    cooldowns: [],
                    statusEffects: [],
                },
            ],
        };
        const client = {
            isActive: true,
            round: 1,
            turn: 0,
            combatants: [
                { id: 'orc', hp: { current: 99, max: 15 } },
            ],
        } as any;
        const merged = mergeClientHostileHpHints(stored, client);
        assert.equal(merged.state.combatants[1].hp.current, 5);
    });

    it('aceita redução de PV de hostil via cliente', () => {
        const stored = {
            isActive: true,
            round: 1,
            turn: 0,
            initiativeOrder: ['orc'],
            log: [],
            combatants: [
                {
                    id: 'orc',
                    name: 'Orc',
                    hp: { current: 10, max: 15 },
                    isPlayer: false,
                    attitude: 'hostile' as const,
                    conditions: [],
                    hasMoved: false,
                    hasActed: false,
                    isDead: false,
                    actionPoints: 0,
                    bonusActionPoints: 0,
                    rollHistory: [],
                    cooldowns: [],
                    statusEffects: [],
                },
            ],
        };
        const client = {
            isActive: true,
            combatants: [{ id: 'orc', hp: { current: 2, max: 15 } }],
        } as any;
        const merged = mergeClientHostileHpHints(stored, client);
        assert.equal(merged.state.combatants[0].hp.current, 2);
        assert.equal(merged.state.combatants[0].isDead, false);
    });

    it('gera loot mínimo de vitória', () => {
        const loot = buildCombatVictoryLoot({ hostileCount: 2, round: 3 });
        assert.ok((loot.currency as { gp?: number })?.gp >= 5);
    });

    it('bloqueia loja durante combate', () => {
        assert.throws(() => assertShopAllowedDuringCombat(true));
    });

    it('remove campos proibidos da resposta narrativa', () => {
        const { cleaned, stripped } = enforceNarrativeOnlyResponse({
            logEntries: [{ type: 'narration', content: 'ok' }],
            actionOptions: [{ text: 'Avançar', action: 'advance' }],
            updatedCharacter: { level: 99 } as any,
            combatState: { isActive: true } as any,
        } as any);
        assert.ok(stripped.includes('updatedCharacter'));
        assert.ok(stripped.includes('combatState'));
        assert.equal((cleaned as any).updatedCharacter, undefined);
    });
});
