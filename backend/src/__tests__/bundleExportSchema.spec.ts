import test from 'node:test';
import assert from 'node:assert/strict';
import { BundleExportManifestSchema } from '../schemas/validationSchemas.js';

test('BundleExportManifestSchema aceita manifesto válido', () => {
    const manifest = {
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        bundle: { name: 'Test Pack', description: 'Demo', isPublic: false },
        contents: [
            {
                exportKey: 'fireball',
                type: 'spell',
                name: 'Bola de Fogo',
                content: { index: 'fireball', name: 'Bola de Fogo', level: 3 },
                sourceKind: 'translation',
                sourceResource: 'spells',
                sourceIndex: 'fireball',
                locale: 'pt-BR',
                dependencyKeys: [],
            },
        ],
    };
    const parsed = BundleExportManifestSchema.parse(manifest);
    assert.equal(parsed.contents[0].exportKey, 'fireball');
});

test('BundleExportManifestSchema rejeita versão inválida', () => {
    assert.throws(() =>
        BundleExportManifestSchema.parse({
            formatVersion: 2,
            exportedAt: new Date().toISOString(),
            bundle: { name: 'X', description: 'Y' },
            contents: [],
        }),
    );
});
