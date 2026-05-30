import { PenaiDataSource } from '../database/data-source.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';
import { appendWorldEvent } from '../events/store.js';

const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

export function levelFromXp(xp: number): number {
    let level = 1;
    for (let i = 1; i < XP_THRESHOLDS.length; i++) {
        if (xp >= XP_THRESHOLDS[i]) level = i + 1;
        else break;
    }
    return Math.min(level, 20);
}

export async function grantHeroXp(
    sessionId: number,
    heroEntityId: string,
    amount: number,
): Promise<{ xp: number; level: number; leveledUp: boolean }> {
    const repo = PenaiDataSource.getRepository(SessionEntityState);
    const state = await repo.findOne({ where: { sessionId, worldEntityId: heroEntityId } });
    if (!state) throw new Error('Estado do herói não encontrado na sessão.');

    const snapshot = { ...(state.sessionStatsSnapshot ?? {}) };
    const prevXp = typeof snapshot.xp === 'number' ? snapshot.xp : 0;
    const prevLevel = typeof snapshot.level === 'number' ? snapshot.level : levelFromXp(prevXp);
    const xp = prevXp + Math.max(0, amount);
    const level = levelFromXp(xp);

    snapshot.xp = xp;
    snapshot.level = level;
    state.sessionStatsSnapshot = snapshot;
    await repo.save(state);

    await appendWorldEvent({
        type: 'HERO_XP_GAIN',
        sessionId,
        actorEntityId: heroEntityId,
        payload: { amount, xp, level, leveledUp: level > prevLevel },
    });

    return { xp, level, leveledUp: level > prevLevel };
}

export async function buildPenaiLevelUpState(
    newLevel: number,
    srdBuild?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
    const asiLevels = [4, 8, 12, 16, 19];
    const hasAsi = asiLevels.includes(newLevel);
    const knownSpells = Array.isArray(srdBuild?.spells) ? (srdBuild!.spells as string[]) : [];
    return {
        isPending: true,
        newLevel,
        choices: {
            ...(hasAsi ? { asi: { count: 2 } } : {}),
            spellsToChoose: newLevel >= 2 ? 1 : 0,
            spellChoiceOptions: knownSpells.slice(0, 8).map(s => ({ index: s, name: s })),
            featureChoices: [],
        },
    };
}
