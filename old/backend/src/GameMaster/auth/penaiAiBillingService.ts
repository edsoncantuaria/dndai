import { PenaiDataSource } from '../database/data-source.js';
import { PenaiUser } from '../database/entities/PenaiUser.js';
import {
    buildAiAccessStatus,
    isPlatformBillingEnabled,
    type AiAccessStatus,
} from '../../services/aiBillingService.js';
import { resolveGeminiApiKey } from '../ai/apiKeyResolve.js';

export async function getPenaiAiAccess(userId: number): Promise<AiAccessStatus | null> {
    if (!PenaiDataSource.isInitialized) return null;
    const user = await PenaiDataSource.getRepository(PenaiUser).findOne({ where: { id: userId } });
    if (!user) return null;
    return buildAiAccessStatus(user, user.apiKey);
}

export async function resolvePenaiInferenceApiKey(userId: number): Promise<string | null> {
    const user = await PenaiDataSource.getRepository(PenaiUser).findOne({ where: { id: userId } });
    if (!user) return null;
    const status = buildAiAccessStatus(user, user.apiKey);
    if (!status.canInfer) return null;
    return resolveGeminiApiKey(user.apiKey) || null;
}

export async function consumePenaiNarrationCredit(userId: number): Promise<boolean> {
    if (!isPlatformBillingEnabled()) return true;
    const repo = PenaiDataSource.getRepository(PenaiUser);
    const user = await repo.findOne({ where: { id: userId } });
    if (!user || (user.aiCreditsRemaining ?? 0) <= 0) return false;
    user.aiCreditsRemaining = Math.max(0, (user.aiCreditsRemaining ?? 0) - 1);
    user.aiCreditsUsed = (user.aiCreditsUsed ?? 0) + 1;
    await repo.save(user);
    return true;
}
