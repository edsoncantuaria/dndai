import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    validateNarrativeConsistency,
    extractMainNarrationText,
} from '../services/narrativeConsistencyValidator.js';

describe('narrativeConsistencyValidator (P5.4)', () => {
    it('detecta contradição acerto motor vs erro na prosa', () => {
        const r = validateNarrativeConsistency(
            'Seu ataque erra feio e não atinge o goblin.',
            ['[Motor] Ataque acertou o alvo.'],
        );
        assert.equal(r.valid, false);
    });

    it('aceita narração alinhada ao acerto', () => {
        const r = validateNarrativeConsistency(
            'A lâmina encontra a brecha e o goblin geme.',
            ['[Motor] Ataque acertou o alvo.'],
        );
        assert.equal(r.valid, true);
    });

    it('extractMainNarrationText prioriza narration', () => {
        const t = extractMainNarrationText({
            narration: '  Cena escura. ',
            logEntries: [{ type: 'narration', content: 'outro' }],
        });
        assert.equal(t.trim(), 'Cena escura.');
    });
});
