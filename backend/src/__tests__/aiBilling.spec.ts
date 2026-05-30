import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildAiAccessStatus,
    includedCreditsForNewUser,
    isPlatformBillingEnabled,
} from '../services/aiBillingService.js';

describe('aiBillingService', () => {
    it('inclui créditos padrão para novos usuários', () => {
        const n = includedCreditsForNewUser();
        assert.ok(n >= 0);
    });

    it('BYOK gemini habilita inferência sem créditos', () => {
        const prev = process.env.GEMINI_API_KEY;
        process.env.GEMINI_API_KEY = 'AIzaSyTestKeyForBillingUnit';
        process.env.AI_ENGINE = 'gemini';
        const status = buildAiAccessStatus(
            { aiCreditsRemaining: 0, aiCreditsUsed: 0 },
            'AIzaSyUserOwnKey123456789',
        );
        assert.equal(status.billingMode, 'byok');
        assert.equal(status.canInfer, true);
        assert.equal(status.hasByok, true);
        if (prev) process.env.GEMINI_API_KEY = prev;
        else delete process.env.GEMINI_API_KEY;
    });

    it('créditos da plataforma habilitam inferência sem BYOK', () => {
        const prevGemini = process.env.GEMINI_API_KEY;
        const prevBilling = process.env.AI_PLATFORM_BILLING_ENABLED;
        process.env.GEMINI_API_KEY = 'AIzaSyPlatformKeyForBilling';
        process.env.AI_ENGINE = 'gemini';
        process.env.AI_PLATFORM_BILLING_ENABLED = 'true';
        const status = buildAiAccessStatus(
            { aiCreditsRemaining: 5, aiCreditsUsed: 2 },
            '',
        );
        assert.equal(status.billingMode, 'platform_credits');
        assert.equal(status.canInfer, true);
        assert.equal(status.creditsRemaining, 5);
        if (prevGemini) process.env.GEMINI_API_KEY = prevGemini;
        else delete process.env.GEMINI_API_KEY;
        if (prevBilling !== undefined) process.env.AI_PLATFORM_BILLING_ENABLED = prevBilling;
        else delete process.env.AI_PLATFORM_BILLING_ENABLED;
    });

    it('sem BYOK nem créditos bloqueia com billing ligado', () => {
        const prevGemini = process.env.GEMINI_API_KEY;
        const prevBilling = process.env.AI_PLATFORM_BILLING_ENABLED;
        delete process.env.GEMINI_API_KEY;
        process.env.AI_PLATFORM_BILLING_ENABLED = 'true';
        process.env.AI_ENGINE = 'gemini';
        const status = buildAiAccessStatus(
            { aiCreditsRemaining: 0, aiCreditsUsed: 0 },
            '',
        );
        assert.equal(status.canInfer, false);
        assert.equal(status.billingMode, 'unavailable');
        if (prevGemini) process.env.GEMINI_API_KEY = prevGemini;
        if (prevBilling !== undefined) process.env.AI_PLATFORM_BILLING_ENABLED = prevBilling;
        else delete process.env.AI_PLATFORM_BILLING_ENABLED;
    });

    it('BYOK Gemini dispensa chave de servidor', () => {
        const prevGemini = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        process.env.AI_ENGINE = 'gemini';
        const status = buildAiAccessStatus(
            { aiCreditsRemaining: 0, aiCreditsUsed: 0 },
            'AIzaSyUserByokKeyOnly12345',
        );
        assert.equal(status.canInfer, true);
        assert.equal(status.billingMode, 'byok');
        if (prevGemini) process.env.GEMINI_API_KEY = prevGemini;
    });

    it('platform billing flag é legível', () => {
        assert.equal(typeof isPlatformBillingEnabled(), 'boolean');
    });
});
