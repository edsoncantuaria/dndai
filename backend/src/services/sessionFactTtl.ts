import { AppDataSource } from '../database/data-source.js';
import { SessionFact, type SessionFactTier } from '../entities/SessionFact.js';
import { LessThan } from 'typeorm';

const TTL_HOURS: Record<SessionFactTier, number | null> = {
    ephemeral: Number(process.env.SESSION_FACT_TTL_EPHEMERAL_HOURS ?? 4),
    scene: Number(process.env.SESSION_FACT_TTL_SCENE_HOURS ?? 48),
    persistent: null,
};

export function resolveFactTierFromCategory(category: string): SessionFactTier {
    if (category === 'general') return 'ephemeral';
    if (category === 'quest') return 'persistent';
    return 'scene';
}

/** Desativa fatos expirados por tier (soft delete via isActive). */
export async function expireStaleSessionFacts(sessaoId: number): Promise<number> {
    const repo = AppDataSource.getRepository(SessionFact);
    const now = Date.now();
    let total = 0;

    for (const tier of ['ephemeral', 'scene'] as SessionFactTier[]) {
        const hours = TTL_HOURS[tier];
        if (!hours || !Number.isFinite(hours) || hours <= 0) continue;
        const cutoff = new Date(now - hours * 60 * 60 * 1000);
        const result = await repo.update(
            { sessaoId, tier, isActive: true, createdAt: LessThan(cutoff) },
            { isActive: false },
        );
        total += result.affected ?? 0;
    }
    return total;
}
