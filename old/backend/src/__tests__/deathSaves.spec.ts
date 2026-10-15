import test from 'node:test';
import assert from 'node:assert/strict';
import {
    applyDamageWhileUnconscious,
    enterUnconscious,
    needsDeathSaveRoll,
    resolveDeathSaveRoll,
    syncVitalsAfterHpChange,
    wakeFromHealing,
    type HeroVitals,
} from '../rules/deathSaves.js';

function baseVitals(overrides: Partial<HeroVitals> = {}): HeroVitals {
    return {
        hp: 10,
        maxHp: 20,
        heroStatus: 'alive',
        deathSaves: { successes: 0, failures: 0 },
        conditions: [],
        ...overrides,
    };
}

test('enterUnconscious zera death saves e aplica condição', () => {
    const out = enterUnconscious(baseVitals({ hp: 0 }));
    assert.equal(out.heroStatus, 'unconscious');
    assert.deepEqual(out.deathSaves, { successes: 0, failures: 0 });
    assert.ok(out.conditions.includes('unconscious'));
});

test('syncVitalsAfterHpChange — queda a 0 HP', () => {
    const out = syncVitalsAfterHpChange(baseVitals({ hp: 0 }), 5);
    assert.equal(out.heroStatus, 'unconscious');
    assert.equal(out.hp, 0);
});

test('resolveDeathSaveRoll — sucesso incrementa successes', () => {
    const v = enterUnconscious(baseVitals({ hp: 0 }));
    const out = resolveDeathSaveRoll(v, 12, 10);
    assert.equal(out.kind, 'unconscious');
    if (out.kind === 'unconscious') {
        assert.equal(out.vitals.deathSaves.successes, 1);
    }
});

test('resolveDeathSaveRoll — nat 1 adiciona 2 falhas', () => {
    const v = enterUnconscious(baseVitals({ hp: 0 }));
    const out = resolveDeathSaveRoll(v, 3, 1);
    assert.equal(out.kind, 'unconscious');
    if (out.kind === 'unconscious') {
        assert.equal(out.vitals.deathSaves.failures, 2);
    }
});

test('resolveDeathSaveRoll — nat 20 revive com 1 HP', () => {
    const v = enterUnconscious(baseVitals({ hp: 0 }));
    const out = resolveDeathSaveRoll(v, 25, 20);
    assert.equal(out.kind, 'revived');
    if (out.kind === 'revived') {
        assert.equal(out.hp, 1);
        assert.equal(out.vitals.heroStatus, 'alive');
    }
});

test('resolveDeathSaveRoll — 3 falhas = morte', () => {
    const v = baseVitals({
        hp: 0,
        heroStatus: 'unconscious',
        deathSaves: { successes: 0, failures: 2 },
        conditions: ['unconscious'],
    });
    const out = resolveDeathSaveRoll(v, 5, 5);
    assert.equal(out.kind, 'dead');
});

test('applyDamageWhileUnconscious — crítico = 2 falhas', () => {
    const v = enterUnconscious(baseVitals({ hp: 0 }));
    const out = applyDamageWhileUnconscious(v, { isCritical: true });
    assert.equal(out.deathSaves.failures, 2);
});

test('wakeFromHealing limpa unconscious', () => {
    const v = enterUnconscious(baseVitals({ hp: 0 }));
    const out = wakeFromHealing({ ...v, hp: 5 });
    assert.equal(out.heroStatus, 'alive');
    assert.equal(out.hp, 5);
    assert.ok(!out.conditions.includes('unconscious'));
});

test('needsDeathSaveRoll — inconsciente precisa rolar', () => {
    const v = enterUnconscious(baseVitals({ hp: 0 }));
    assert.equal(needsDeathSaveRoll(v), true);
});
