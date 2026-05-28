import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    OssMinimalNarrationSchema,
    mapMinimalToGameMasterShape,
} from '../ai-oss/schemas/minimalNarration.schema.js';

describe('OssMinimalNarrationSchema', () => {
    it('aceita narração mínima válida', () => {
        const parsed = OssMinimalNarrationSchema.parse({
            narration: 'A espada corta o ar.',
            tone: 'tense',
        });
        assert.equal(parsed.narration, 'A espada corta o ar.');
    });

    it('mapeia para logEntries e actionOptions do registry', () => {
        const mapped = mapMinimalToGameMasterShape(
            { narration: 'O goblin recua.' },
            'gameplay',
        );
        assert.ok(mapped.logEntries?.length);
        assert.ok(Array.isArray(mapped.actionOptions));
    });
});
