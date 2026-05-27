import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeOssNarrationPayload,
    normalizeImportanceValue,
} from '../ai-oss/parser/localFieldRepair.js';
import { validateOssNarration } from '../ai-oss/validators/narrationValidator.js';

test('normalizeImportanceValue aceita português', () => {
    assert.equal(normalizeImportanceValue('alta'), 'high');
    assert.equal(normalizeImportanceValue('média'), 'medium');
    assert.equal(normalizeImportanceValue('baixa'), 'low');
});

test('normalizeOssNarrationPayload: narration array + chave extra + newFacts PT', () => {
    const raw = {
        QUALIDADE_NARRATIVA: 'não deve ir para o schema',
        narration: ['Primeira frase.', 'Segunda frase com gancho.'],
        actionOptions: [
            { texto: 'Observar a taverna de longe', acao: 'observe' },
            { descricao: 'Entrar pela porta principal', opcao: 'enter' },
            'Perguntar ao guarda sobre rumores',
            { text: 'Vasculhar o beco lateral', action: 'search' },
        ],
        newFacts: [
            { fato: 'O guarda usa um brasão azul.', importancia: 'alta' },
            { fact: 'A taverna cheira a ale e fumaça.', importance: 'média' },
        ],
    };
    const normalized = normalizeOssNarrationPayload(raw, { domain: 'exploration' });
    assert.ok(normalized);
    assert.equal(
        normalized!.narration,
        'Primeira frase.\n\nSegunda frase com gancho.',
    );
    assert.ok(normalized!.actionOptions.length >= 2);
    assert.equal(normalized!.newFacts?.[0].importance, 'high');
    assert.equal(normalized!.newFacts?.[1].importance, 'medium');

    const validated = validateOssNarration(raw, { domain: 'exploration' });
    assert.equal(validated.valid, true);
    assert.ok(validated.data?.actionOptions.length);
});

test('validateOssNarration rejeita payload sem narrativa', () => {
    const check = validateOssNarration({ actionOptions: ['A', 'B'] });
    assert.equal(check.valid, false);
});
