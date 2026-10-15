import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    maxNarrationCharsForLevel,
    resolveNarrativeLevel,
} from '../config/narrativeLevel.js';

describe('narrativeLevel', () => {
    it('usa standard por padrão', () => {
        const prev = process.env.NARRATIVE_LEVEL;
        delete process.env.NARRATIVE_LEVEL;
        assert.equal(resolveNarrativeLevel('exploro a masmorra'), 'standard');
        if (prev) process.env.NARRATIVE_LEVEL = prev;
    });

    it('compact para viagem/descanso', () => {
        const prev = process.env.NARRATIVE_LEVEL;
        delete process.env.NARRATIVE_LEVEL;
        assert.equal(resolveNarrativeLevel('viajo até a cidade'), 'compact');
        if (prev) process.env.NARRATIVE_LEVEL = prev;
    });

    it('limites de caracteres crescem com o nível', () => {
        assert.ok(
            maxNarrationCharsForLevel('cinematic') > maxNarrationCharsForLevel('compact'),
        );
    });
});
