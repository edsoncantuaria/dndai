import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('isDmLlmClassificationEnabled (P2.4)', () => {
    const keys = ['DM_LLM_CLASSIFY', 'NODE_ENV'] as const;
    const prev: Record<string, string | undefined> = {};

    beforeEach(() => {
        for (const k of keys) prev[k] = process.env[k];
    });

    afterEach(() => {
        for (const k of keys) {
            if (prev[k] === undefined) delete process.env[k];
            else process.env[k] = prev[k];
        }
    });

    it('produção sem env → true (padrão ligado)', async () => {
        delete process.env.DM_LLM_CLASSIFY;
        process.env.NODE_ENV = 'production';
        const { isDmLlmClassificationEnabled } = await import('../services/dm/dmTurnOrchestrator.js');
        assert.equal(isDmLlmClassificationEnabled(), true);
    });

    it('DM_LLM_CLASSIFY=false desliga em qualquer ambiente', async () => {
        process.env.DM_LLM_CLASSIFY = 'false';
        process.env.NODE_ENV = 'production';
        const { isDmLlmClassificationEnabled } = await import('../services/dm/dmTurnOrchestrator.js');
        assert.equal(isDmLlmClassificationEnabled(), false);
    });

    it('DM_LLM_CLASSIFY=true força on em prod', async () => {
        process.env.DM_LLM_CLASSIFY = 'true';
        process.env.NODE_ENV = 'production';
        const { isDmLlmClassificationEnabled } = await import('../services/dm/dmTurnOrchestrator.js');
        assert.equal(isDmLlmClassificationEnabled(), true);
    });
});
