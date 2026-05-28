import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applySnapshotToMemoryLayers } from '../services/narrativeSnapshotService.js';

describe('narrativeSnapshot (P4.5)', () => {
    it('applySnapshotToMemoryLayers combina bloco estático e dinâmico', () => {
        const out = applySnapshotToMemoryLayers(
            {
                staticMemoryBlock: 'Resumo=aventura',
                stateVersion: 2,
                turnCounter: 3,
                builtAt: new Date().toISOString(),
            },
            ['Recall=eco recente'],
        );
        assert.ok(out?.includes('Resumo=aventura'));
        assert.ok(out?.includes('Recall=eco recente'));
    });

    it('sem snapshot usa só camadas dinâmicas', () => {
        const out = applySnapshotToMemoryLayers(null, ['Timeline=ontem']);
        assert.equal(out, 'Timeline=ontem');
    });
});
