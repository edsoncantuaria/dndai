import { PenaiDataSource } from '../database/data-source.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { updateHeroCanonicalStats } from '../world/levelPolicy.js';
import { loadHeroSessionStats, saveHeroSessionStats, getSessionHeroEntityId } from './heroStats.js';
import { mergeSpellSlotsIntoResources } from './spellSlotSeedPenai.js';
import { appendJournalEntry } from '../journal/journalPenai.js';
import { levelFromXp } from './heroXpPenai.js';

export type ApplyLevelUpPayload = {
    newLevel: number;
    attributes?: Record<string, number>;
    spells?: string[];
    hpIncrease?: number;
    subclass?: string;
    featureChoices?: Array<{ featureIndex: string; selections: string[] }>;
};

export async function applyLevelUpPenai(opts: {
    sessionId: number;
    userId: number;
    payload: ApplyLevelUpPayload;
}): Promise<{ ok: boolean; reason?: string; newLevel: number }> {
    const heroId = await getSessionHeroEntityId(opts.sessionId);
    if (!heroId) return { ok: false, reason: 'Herói não encontrado.', newLevel: 0 };

    const heroRepo = PenaiDataSource.getRepository(WorldEntity);
    const hero = await heroRepo.findOne({ where: { id: heroId } });
    if (!hero) return { ok: false, reason: 'Entidade herói não encontrada.', newLevel: 0 };

    const stats = await loadHeroSessionStats(opts.sessionId, heroId);
    const newLevel = Math.min(20, Math.max(1, opts.payload.newLevel));
    const hpInc = typeof opts.payload.hpIncrease === 'number' ? opts.payload.hpIncrease : 0;

    stats.maxHp = stats.maxHp + hpInc;
    stats.hp = Math.min(stats.maxHp, stats.hp + hpInc);

    const srdBuild = { ...((hero.stats?.srdBuild ?? {}) as Record<string, unknown>) };
    srdBuild.level = newLevel;

    if (opts.payload.attributes) {
        const attrs = { ...((srdBuild.attributes ?? {}) as Record<string, number>) };
        for (const [key, delta] of Object.entries(opts.payload.attributes)) {
            if (typeof delta === 'number' && delta > 0) {
                attrs[key] = (attrs[key] ?? 10) + delta;
                const statKey = key as keyof typeof hero.stats;
                if (statKey in hero.stats || ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].includes(key)) {
                    (hero.stats as Record<string, unknown>)[key] =
                        Number((hero.stats as Record<string, unknown>)[key] ?? 10) + delta;
                }
            }
        }
        srdBuild.attributes = attrs;
    }

    if (opts.payload.spells?.length) {
        const prev = Array.isArray(srdBuild.spells) ? (srdBuild.spells as string[]) : [];
        srdBuild.spells = [...new Set([...prev, ...opts.payload.spells])];
    }

    if (opts.payload.subclass) {
        srdBuild.subclass = opts.payload.subclass;
    }

    const classIndex = String(srdBuild.characterClass ?? srdBuild.class ?? 'fighter');
    stats.resources = await mergeSpellSlotsIntoResources(stats.resources, classIndex, newLevel);

    const stateRepo = PenaiDataSource.getRepository(
        (await import('../database/entities/SessionEntityState.js')).SessionEntityState,
    );
    const state = await stateRepo.findOne({ where: { sessionId: opts.sessionId, worldEntityId: heroId } });
    if (state) {
        const snap = { ...(state.sessionStatsSnapshot ?? {}) };
        snap.level = newLevel;
        snap.xp = snap.xp ?? levelFromXp(0);
        state.sessionStatsSnapshot = snap;
        await stateRepo.save(state);
    }

    await saveHeroSessionStats(opts.sessionId, heroId, stats);

    hero.stats = { ...hero.stats, srdBuild, level: newLevel };
    await heroRepo.save(hero);

    await updateHeroCanonicalStats(heroId, opts.userId, {
        level: newLevel,
        srdBuild,
    });

    await appendJournalEntry({
        sessionId: opts.sessionId,
        heroEntityId: heroId,
        title: `Avanço para nível ${newLevel}`,
        body: `Herói confirmou evolução para nível ${newLevel}.`,
        tags: ['level-up'],
    });

    return { ok: true, newLevel };
}
