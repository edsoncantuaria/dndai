import { AI_PRODUCT } from '../config/aiProductDefaults.js';
import {
    isGoogleApiKey,
    hasResolvableGeminiKey,
} from '../GameMaster/ai/apiKeyResolve.js';

export type AiBillingMode = 'byok' | 'platform_credits' | 'unavailable';

export type AiAccessStatus = {
    engine: 'gemini' | 'penai';
    billingMode: AiBillingMode;
    canInfer: boolean;
    hasByok: boolean;
    platformKeyConfigured: boolean;
    creditsRemaining: number;
    creditsUsed: number;
    platformBillingEnabled: boolean;
    includedCreditsPerSignup: number;
};

type CreditUser = {
    aiCreditsRemaining?: number | null;
    aiCreditsUsed?: number | null;
    apiKey?: string | null;
};

const toBoolean = (value: string | undefined, fallback = false) =>
    value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());

export function isPlatformBillingEnabled(): boolean {
    return toBoolean(
        process.env.AI_PLATFORM_BILLING_ENABLED,
        AI_PRODUCT.platformBillingDefault,
    );
}

export function includedCreditsForNewUser(): number {
    const raw = Number(process.env.AI_INCLUDED_CREDITS_DEFAULT ?? AI_PRODUCT.includedCreditsOnSignup);
    if (!Number.isFinite(raw) || raw < 0) return 30;
    return Math.floor(raw);
}

export function isGeminiEngineEnabled(): boolean {
    return true;
}

export function buildAiAccessStatus(
    user: Pick<CreditUser, 'aiCreditsRemaining' | 'aiCreditsUsed'>,
    userKey?: string | null,
): AiAccessStatus {
    const platformBillingEnabled = isPlatformBillingEnabled();
    const hasByok = Boolean(userKey?.trim()) && isGoogleApiKey(userKey ?? '');
    const platformKeyConfigured = hasResolvableGeminiKey('');
    const creditsRemaining = Math.max(0, user.aiCreditsRemaining ?? 0);
    const creditsUsed = Math.max(0, user.aiCreditsUsed ?? 0);

    const byokResolvable = hasByok && hasResolvableGeminiKey(userKey);

    let billingMode: AiBillingMode = 'unavailable';
    if (byokResolvable) {
        billingMode = 'byok';
    } else if (platformBillingEnabled && platformKeyConfigured && creditsRemaining > 0) {
        billingMode = 'platform_credits';
    } else if (!platformBillingEnabled && platformKeyConfigured) {
        billingMode = 'byok';
    }

    const canInfer =
        billingMode === 'byok'
            ? byokResolvable || (!isPlatformBillingEnabled() && platformKeyConfigured)
            : billingMode === 'platform_credits';

    return {
        engine: 'penai',
        billingMode,
        canInfer,
        hasByok,
        platformKeyConfigured,
        creditsRemaining,
        creditsUsed,
        platformBillingEnabled,
        includedCreditsPerSignup: includedCreditsForNewUser(),
    };
}

export async function resolveInferenceApiKey(userId: number): Promise<string | null> {
    const { resolvePenaiInferenceApiKey } = await import(
        '../GameMaster/auth/penaiAiBillingService.js'
    );
    return resolvePenaiInferenceApiKey(userId);
}

export function hasResolvableInferenceKey(userKey?: string | null): boolean {
    return hasResolvableGeminiKey(userKey);
}

export async function getAiAccessForUser(userId: number): Promise<AiAccessStatus | null> {
    const { getPenaiAiAccess } = await import('../GameMaster/auth/penaiAiBillingService.js');
    return getPenaiAiAccess(userId);
}

export async function consumePlatformNarrationCredit(userId: number): Promise<boolean> {
    const { consumePenaiNarrationCredit } = await import(
        '../GameMaster/auth/penaiAiBillingService.js'
    );
    return consumePenaiNarrationCredit(userId);
}
