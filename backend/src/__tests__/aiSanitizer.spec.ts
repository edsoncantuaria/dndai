import test from 'node:test';
import assert from 'node:assert/strict';

let cachedSanitizer:
    | ((
          response: any,
          character?: any,
          flowInput?: Record<string, unknown>,
      ) => any)
    | null = null;

const loadSanitizer = async () => {
    if (cachedSanitizer) return cachedSanitizer;
    process.env.REDIS_URL = process.env.REDIS_URL || 'mock';
    const mod = await import('../services/aiSanitizer.js');
    cachedSanitizer = mod.sanitizeGameMasterResponse;
    return cachedSanitizer;
};

test('sanitizeGameMasterResponse removes AI roll requests when suppressRollRequest=true', async () => {
    const sanitizeGameMasterResponse = await loadSanitizer();
    const response = {
        playerRollRequest: {
            reason: 'Faça um teste de Arcana',
            dice: '1d20',
            modifier: 3,
            rollType: 'check',
            advantage: false,
            disadvantage: false,
        },
        useHitDiceRequest: {
            maxDice: 2,
            hitDieValue: 8,
        },
    };
    const sanitized = sanitizeGameMasterResponse(response, undefined, { suppressRollRequest: true });
    assert.equal(sanitized.playerRollRequest, undefined);
    assert.equal(sanitized.useHitDiceRequest, undefined);
});

test('sanitizeGameMasterResponse does not create fallback roll when suppressed', async () => {
    const sanitizeGameMasterResponse = await loadSanitizer();
    const response = {
        logEntries: [
            {
                type: 'system',
                content: 'Após o descanso curto, o grupo tenta recuperar forças.',
            },
        ],
        combatState: { isActive: false },
    };
    const sanitized = sanitizeGameMasterResponse(response, undefined, { suppressRollRequest: true });
    assert.equal(sanitized.playerRollRequest, undefined);
    assert.equal(sanitized.useHitDiceRequest, undefined);
});

test('sanitizeGameMasterResponse forces roll gating when playerRollRequest is present', async () => {
    const sanitizeGameMasterResponse = await loadSanitizer();
    const response = {
        logEntries: [
            { type: 'narration', content: 'O mestre resolve tudo antes da rolagem.' },
            { type: 'system', content: 'Alguma instrução antiga.' },
        ],
        actionOptions: ['Atacar', 'Fugir'],
        playerRollRequest: {
            reason: 'Teste de Percepção',
            dice: '1d20',
            modifier: 2,
            rollType: 'check',
            advantage: false,
            disadvantage: false,
        },
    };
    const sanitized = sanitizeGameMasterResponse(response, undefined, {});
    assert.ok(Array.isArray(sanitized.logEntries), 'logEntries deve existir');
    assert.equal(sanitized.logEntries?.every((entry: any) => entry.type === 'system'), true);
    assert.ok(
        sanitized.logEntries?.some((entry: any) =>
            typeof entry.content === 'string' && entry.content.toLowerCase().includes('aguarda')
        ),
        'deve existir aviso aguardando rolagem'
    );
    assert.equal(Array.isArray(sanitized.actionOptions) ? sanitized.actionOptions.length : 0, 0);
    assert.ok(sanitized.playerRollRequest, 'playerRollRequest deve permanecer definido');
});
