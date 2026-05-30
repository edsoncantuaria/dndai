import {
    loadSrdClassLevels,
    loadSrdSubclassLevels,
    resolveSrdClassIndex,
    resolveSrdSubclassIndex,
} from '../../services/srdClassResolve.js';
import { getSrdResource } from '../../services/srdCatalogService.js';
import { listSessionWorldEvents } from '../events/store.js';
import { levelFromXp, xpRequiredForNextLevel } from './xp.js';
import { PenaiDataSource } from '../database/data-source.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';

export type PenaiProgressionPack = {
    xp: number;
    level: number;
    xpToNextLevel: number;
    classLevelsData: unknown[];
    subclassLevelsData: unknown[];
    progressionFeed: Array<{
        type: 'xp_gain' | 'level_up';
        summary: string;
        source?: string;
        detail?: string;
        xp?: number;
        level?: number;
    }>;
};

async function buildProgressionFeed(
    sessionId: number,
): Promise<PenaiProgressionPack['progressionFeed']> {
    const events = await listSessionWorldEvents(sessionId, 40);
    const feed: PenaiProgressionPack['progressionFeed'] = [];

    for (const ev of events) {
        if (ev.type !== 'HERO_XP_GAIN') continue;
        const p = ev.payload ?? {};
        const amount = Number(p.amount ?? 0);
        const level = Number(p.level ?? 1);
        const leveledUp = Boolean(p.leveledUp);
        if (leveledUp) {
            feed.push({
                type: 'level_up',
                summary: `Você alcançou o nível ${level}!`,
                detail: 'Novas opções de progressão disponíveis.',
                level,
            });
        }
        if (amount > 0) {
            feed.push({
                type: 'xp_gain',
                summary: leveledUp ? `+${amount} XP (nível ${level})` : `+${amount} XP`,
                xp: amount,
                source: 'Campanha',
            });
        }
    }

    return feed.slice(0, 8);
}

export async function loadPenaiProgressionPack(opts: {
    sessionId: number;
    heroEntityId: string;
    srdBuild: Record<string, unknown>;
}): Promise<PenaiProgressionPack> {
    const stateRepo = PenaiDataSource.getRepository(SessionEntityState);
    const state = await stateRepo.findOne({
        where: { sessionId: opts.sessionId, worldEntityId: opts.heroEntityId },
    });
    const snap = (state?.sessionStatsSnapshot ?? {}) as Record<string, unknown>;

    const xp = typeof snap.xp === 'number' ? snap.xp : 0;
    const vaultLevel =
        typeof opts.srdBuild.level === 'number' ? opts.srdBuild.level : levelFromXp(xp);
    const sessionLevel = typeof snap.level === 'number' ? snap.level : vaultLevel;
    const level = Math.max(vaultLevel, sessionLevel, levelFromXp(xp));
    const xpToNextLevel = xpRequiredForNextLevel(level);

    const classIndex =
        resolveSrdClassIndex(opts.srdBuild.characterClass) ||
        resolveSrdClassIndex(opts.srdBuild.class) ||
        resolveSrdClassIndex(opts.srdBuild.characterClassLabel);

    let classLevelsData: unknown[] = [];
    let subclassLevelsData: unknown[] = [];

    if (classIndex) {
        classLevelsData = await loadSrdClassLevels(classIndex);
        const classEntry = await getSrdResource('classes', classIndex);
        const subclassIndex =
            resolveSrdSubclassIndex(opts.srdBuild.subclass) ||
            resolveSrdSubclassIndex(opts.srdBuild.subclassFlavor) ||
            resolveSrdSubclassIndex(
                (classEntry as { subclasses?: Array<{ index?: string }> } | null)?.subclasses?.[0]
                    ?.index,
            );
        if (subclassIndex) {
            subclassLevelsData = await loadSrdSubclassLevels(subclassIndex);
        }
    }

    const progressionFeed = await buildProgressionFeed(opts.sessionId);

    return {
        xp,
        level,
        xpToNextLevel,
        classLevelsData,
        subclassLevelsData,
        progressionFeed,
    };
}
