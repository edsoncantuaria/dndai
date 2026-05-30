import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composeWorldPulsePresentation } from '../GameMaster/world/pulseCopy.js';

describe('composeWorldPulsePresentation', () => {
    it('monta headline e batidas a partir da simulação', () => {
        const out = composeWorldPulsePresentation({
            regionSlug: 'porto-corsario',
            regionMood: { fear: 70, prosperity: 30, crime: 40 },
            simulationLines: [
                'Patrulhas aumentaram perto das fronteiras da região.',
                'Ao fundo, Marta está negociando com o contramestre.',
            ],
            rumorBodies: ['Um mensageiro desapareceu na estrada principal.'],
        });
        assert.ok(out);
        assert.ok(out!.headline.length > 10);
        assert.ok(out!.beats.length >= 1);
        assert.equal(out!.mood, 'ominous');
    });

    it('retorna null sem conteúdo', () => {
        const out = composeWorldPulsePresentation({
            regionSlug: null,
            simulationLines: [],
            rumorBodies: [],
        });
        assert.equal(out, null);
    });
});
