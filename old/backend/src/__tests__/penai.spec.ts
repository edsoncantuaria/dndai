import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNarrationPtBr, isPredominantlyEnglish } from '../GameMaster/locale/narrationGuard.js';

test('narrationGuard aceita texto em português', () => {
    const pt =
        'Você avança pela ponte sul. O vento frio traz o cheiro de ferro e pólvora. Um guarda observa de longe.';
    assert.equal(isPredominantlyEnglish(pt), false);
    assert.equal(assertNarrationPtBr(pt).ok, true);
});

test('narrationGuard rejeita bloco predominantemente em inglês', () => {
    const en =
        'You enter the tavern and the barkeep looks at you. What do you want to do next in this dungeon crawl adventure?';
    assert.equal(isPredominantlyEnglish(en), true);
    assert.equal(assertNarrationPtBr(en).ok, false);
});

test('actionOptions retorna labels PT-BR', async () => {
    const { getActionOptionsForDomain } = await import('../GameMaster/world/actionOptions.js');
    const opts = getActionOptionsForDomain('combat');
    assert.ok(opts.some(o => o.label === 'Atacar'));
});
