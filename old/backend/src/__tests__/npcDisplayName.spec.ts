import test from 'node:test';
import assert from 'node:assert/strict';
import {
    formatNpcDisplayName,
    normalizeBootstrapNpcIdentity,
    parseNpcDisplayName,
} from '../GameMaster/world/npcDisplayName.js';

test('formatNpcDisplayName — Uldric, Mestre da Forja', () => {
    assert.equal(formatNpcDisplayName('Uldric', 'Mestre da Forja'), 'Uldric, Mestre da Forja');
});

test('normalizeBootstrapNpcIdentity aceita givenName + roleTitle', () => {
    const n = normalizeBootstrapNpcIdentity({
        givenName: 'Bruna',
        roleTitle: 'Ferreira do Portão',
    });
    assert.equal(n.displayName, 'Bruna, Ferreira do Portão');
});

test('normalizeBootstrapNpcIdentity migra displayName legado', () => {
    const n = normalizeBootstrapNpcIdentity({
        displayName: 'Tomas Viel, Guarda do Mercado',
    });
    assert.equal(n.givenName, 'Tomas Viel');
    assert.equal(n.roleTitle, 'Guarda do Mercado');
});

test('parseNpcDisplayName divide por vírgula', () => {
    const p = parseNpcDisplayName('Mira, Mercadora de Especiarias');
    assert.equal(p.givenName, 'Mira');
    assert.equal(p.roleTitle, 'Mercadora de Especiarias');
});
