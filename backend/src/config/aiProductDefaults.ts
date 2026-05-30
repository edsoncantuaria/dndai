/**
 * Defaults do produto — Gemini + BYOK.
 * OSS/OpenRouter só com AI_ENGINE=oss explícito (legado).
 */
export const AI_PRODUCT = {
    engine: 'gemini' as const,
    provider: 'gemini' as const,
    defaultModel: 'gemini-2.5-flash',
    failoverChain: 'gemini-2.5-flash,gemini-2.5-flash-lite',
    embeddingProvider: 'gemini' as const,
    streamNarration: true,
    /** BYOK primeiro; créditos de plataforma só se AI_PLATFORM_BILLING_ENABLED=true */
    platformBillingDefault: false,
    includedCreditsOnSignup: 30,
} as const;
