import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import { PenaiDataSource } from '../GameMaster/database/data-source.js';
import { AI_PRODUCT } from '../config/aiProductDefaults.js';
import {
    isGoogleApiKey,
    resolveGeminiApiKey,
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
    user: Pick<User, 'aiCreditsRemaining' | 'aiCreditsUsed'>,
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
    if (PenaiDataSource.isInitialized) {
        const { resolvePenaiInferenceApiKey } = await import(
            '../GameMaster/auth/penaiAiBillingService.js'
        );
        const penaiKey = await resolvePenaiInferenceApiKey(userId);
        if (penaiKey) return penaiKey;
    }
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    const status = buildAiAccessStatus(user, user.apiKey);
    if (!status.canInfer) return null;
    const key = resolveGeminiApiKey(user.apiKey);
    return key || null;
}

export function hasResolvableInferenceKey(userKey?: string | null): boolean {
    return hasResolvableGeminiKey(userKey);
}

export async function getAiAccessForUser(userId: number): Promise<AiAccessStatus | null> {
    if (PenaiDataSource.isInitialized) {
        const { getPenaiAiAccess } = await import('../GameMaster/auth/penaiAiBillingService.js');
        const penai = await getPenaiAiAccess(userId);
        if (penai) return penai;
    }
    const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });
    if (!user) return null;
    return buildAiAccessStatus(user, user.apiKey);
}

export async function consumePlatformNarrationCredit(userId: number): Promise<boolean> {
    if (PenaiDataSource.isInitialized) {
        const { consumePenaiNarrationCredit } = await import(
            '../GameMaster/auth/penaiAiBillingService.js'
        );
        return consumePenaiNarrationCredit(userId);
    }
    if (!isPlatformBillingEnabled()) return true;
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOne({ where: { id: userId } });
    if (!user || (user.aiCreditsRemaining ?? 0) <= 0) return false;
    user.aiCreditsRemaining = Math.max(0, (user.aiCreditsRemaining ?? 0) - 1);
    user.aiCreditsUsed = (user.aiCreditsUsed ?? 0) + 1;
    await repo.save(user);
    return true;
}
