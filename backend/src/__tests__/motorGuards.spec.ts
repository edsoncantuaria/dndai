import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enforceNarrativeOnlyResponse } from '../GameMaster/ai/narrativeContract.js';

describe('motorGuards', () => {
    it('remove campos proibidos da resposta narrativa', () => {
        const { cleaned, stripped } = enforceNarrativeOnlyResponse({
            logEntries: [{ type: 'narration', content: 'ok' }],
            actionOptions: [{ text: 'Avançar', action: 'advance' }],
            updatedCharacter: { level: 99 } as any,
            combatState: { isActive: true } as any,
        } as any);
        assert.ok(stripped.includes('updatedCharacter'));
        assert.ok(stripped.includes('combatState'));
        assert.equal((cleaned as any).updatedCharacter, undefined);
    });
});
