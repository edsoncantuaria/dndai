import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePlayerActionForDisplay } from '../services/dm/playerActionDisplay.js';

test('resolvePlayerActionForDisplay: extrai ação curta do prompt', () => {
    const prompt =
        '[Elenco da sessão]\n[Fase: ação livre]\nAção do jogador: Observar o ambiente\nSe a ação não exigiu rolagem…';
    assert.equal(resolvePlayerActionForDisplay(prompt), 'Observar o ambiente');
});

test('resolvePlayerActionForDisplay: usa display explícito', () => {
    assert.equal(resolvePlayerActionForDisplay('prompt longo…', 'Atacar goblin'), 'Atacar goblin');
});
