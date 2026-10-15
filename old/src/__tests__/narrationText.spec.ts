import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeSensoryTail } from '../lib/narrationText.js';

test('dedupeSensoryTail remove âncora repetida no final', () => {
    const body =
        'Você acorda em Valdarin Violeta, metrópole élfica em névoa lilás. O ar traz aroma adocicado e sinos de cristal ecoam.';
    const raw = `${body}\n\nNévoa lilás, aroma adocicado, sinos de cristal.`;
    const out = dedupeSensoryTail(raw);
    assert.ok(!out.includes('Névoa lilás, aroma adocicado, sinos de cristal.'));
    assert.match(out, /Valdarin Violeta/);
});
