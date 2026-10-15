import { randomUUID } from 'crypto';
import type { PlayerRollRequest } from '../../types.js';
import {
    needsDeathSaveRoll,
    resolveDeathSaveRoll,
    syncVitalsAfterHpChange,
    type HeroVitals,
} from '../../rules/deathSaves.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import {
    getSessionHeroEntityId,
    loadHeroSessionStats,
    saveHeroSessionStats,
    type HeroSessionStats,
} from './heroStats.js';
import { appendWorldEvent } from '../events/store.js';
import { publishWsToUser } from '../transport/wsPubSub.js';
import { endPenaiCombat } from '../combat/engine.js';
import { loadPenaiCharacterSnapshot } from './loadSnapshot.js';
import { penaiPipelineLog } from '../infra/pipelineLog.js';

export type HeroVitalsChangeResult = {
    stats: HeroSessionStats;
    changed: boolean;
    permanentlyDead?: boolean;
    needsDeathSave?: boolean;
};

function statsToVitals(stats: HeroSessionStats): HeroVitals {
    return {
        hp: stats.hp,
        maxHp: stats.maxHp,
        heroStatus: stats.heroStatus,
        deathSaves: { ...stats.deathSaves },
        conditions: [...stats.conditions],
    };
}

function applyVitalsToStats(stats: HeroSessionStats, vitals: HeroVitals): HeroSessionStats {
    return {
        ...stats,
        hp: vitals.hp,
        heroStatus: vitals.heroStatus,
        deathSaves: { ...vitals.deathSaves },
        conditions: [...vitals.conditions],
    };
}

export async function getHeroVitals(sessionId: number): Promise<HeroSessionStats | null> {
    const heroId = await getSessionHeroEntityId(sessionId);
    if (!heroId) return null;
    return loadHeroSessionStats(sessionId, heroId);
}

export async function isSessionHeroDead(sessionId: number): Promise<boolean> {
    const stats = await getHeroVitals(sessionId);
    return stats?.heroStatus === 'dead';
}

export async function isSessionEnded(sessionId: number): Promise<boolean> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    return session?.sessionStatus === 'ended_death' || session?.sessionStatus === 'ended_abandon';
}

export async function syncHeroVitalsAfterHpChange(
    sessionId: number,
    opts: {
        prevHp: number;
        damageWhileDown?: boolean;
        isCritical?: boolean;
        userId?: number;
    },
): Promise<HeroVitalsChangeResult | null> {
    const heroId = await getSessionHeroEntityId(sessionId);
    if (!heroId) return null;

    const stats = await loadHeroSessionStats(sessionId, heroId);
    const vitals = syncVitalsAfterHpChange(statsToVitals(stats), opts.prevHp, {
        damageWhileDown: opts.damageWhileDown,
        isCritical: opts.isCritical,
    });

    const next = applyVitalsToStats(stats, vitals);
    const changed =
        next.hp !== stats.hp ||
        next.heroStatus !== stats.heroStatus ||
        next.deathSaves.successes !== stats.deathSaves.successes ||
        next.deathSaves.failures !== stats.deathSaves.failures ||
        JSON.stringify(next.conditions) !== JSON.stringify(stats.conditions);

    if (!changed) {
        return { stats, changed: false };
    }

    await saveHeroSessionStats(sessionId, heroId, next);

    if (next.heroStatus === 'dead') {
        await markHeroPermanentlyDead(sessionId, opts.userId);
        return { stats: next, changed: true, permanentlyDead: true };
    }

    await appendWorldEvent({
        type: 'HERO_VITALS_CHANGED',
        sessionId,
        actorEntityId: heroId,
        payload: {
            heroStatus: next.heroStatus,
            hp: next.hp,
            deathSaves: next.deathSaves,
        },
    });

    return {
        stats: next,
        changed: true,
        needsDeathSave: needsDeathSaveRoll(statsToVitals(next)),
    };
}

export async function buildDeathSaveRollRequest(
    sessionId: number,
    opts: {
        actionId: string;
        actionSequence: number;
    },
): Promise<PlayerRollRequest | null> {
    const stats = await getHeroVitals(sessionId);
    if (!stats || !needsDeathSaveRoll(statsToVitals(stats))) return null;

    const snapshot = await loadPenaiCharacterSnapshot(sessionId);
    const conMod = snapshot
        ? Math.floor((snapshot.abilities.constitution - 10) / 2)
        : 0;

    return {
        reason: 'Teste de morte — mantenha-se vivo!',
        dice: '1d20',
        modifier: conMod,
        dc: 10,
        rollType: 'save',
        requestId: randomUUID(),
        details: [
            `Sucessos: ${stats.deathSaves.successes}/3`,
            `Falhas: ${stats.deathSaves.failures}/3`,
        ],
        metadata: {
            deathSave: true,
            targets: [{ kind: 'character' as const, id: 'hero', name: snapshot?.name ?? 'Herói' }],
        },
    };
}

export type DeathSaveResolveOutcome = {
    kind: 'dead' | 'stable' | 'unconscious' | 'revived';
    stats: HeroSessionStats;
    hints: string[];
};

export async function resolveDeathSaveForSession(
    sessionId: number,
    rollTotal: number,
    rawD20: number,
    userId?: number,
): Promise<DeathSaveResolveOutcome | null> {
    const heroId = await getSessionHeroEntityId(sessionId);
    if (!heroId) return null;

    const stats = await loadHeroSessionStats(sessionId, heroId);
    const outcome = resolveDeathSaveRoll(statsToVitals(stats), rollTotal, rawD20);

    if (outcome.kind === 'dead') {
        const deadStats = applyVitalsToStats(stats, {
            ...statsToVitals(stats),
            hp: 0,
            heroStatus: 'dead',
            deathSaves: { successes: stats.deathSaves.successes, failures: 3 },
            conditions: stats.conditions.filter(c => c !== 'unconscious'),
        });
        await saveHeroSessionStats(sessionId, heroId, deadStats);
        await markHeroPermanentlyDead(sessionId, userId);
        return {
            kind: 'dead',
            stats: deadStats,
            hints: ['O herói não resistiu — morte permanente.'],
        };
    }

    const vitals =
        outcome.kind === 'revived'
            ? outcome.vitals
            : outcome.kind === 'stable'
              ? outcome.vitals
              : outcome.vitals;

    const next = applyVitalsToStats(stats, vitals);
    await saveHeroSessionStats(sessionId, heroId, next);
    await import('./syncHeroHp.js').then(m => m.syncHeroHpPenai(sessionId));

    const hints: string[] = [];
    if (outcome.kind === 'revived') {
        hints.push('Um surto de vitalidade — o herói acorda com 1 PV!');
    } else if (outcome.kind === 'stable') {
        hints.push(
            `Estável a 0 PV (${next.deathSaves.successes} sucessos nos testes de morte).`,
        );
    } else {
        hints.push(
            `Inconsciente — ${next.deathSaves.successes} sucesso(s), ${next.deathSaves.failures} falha(s).`,
        );
    }

    await appendWorldEvent({
        type: 'DEATH_SAVE_RESOLVED',
        sessionId,
        actorEntityId: heroId,
        payload: { kind: outcome.kind, deathSaves: next.deathSaves, hp: next.hp },
    });

    return { kind: outcome.kind, stats: next, hints };
}

export async function markHeroPermanentlyDead(
    sessionId: number,
    userId?: number,
): Promise<void> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) return;

    if (session.sessionStatus === 'ended_death') return;

    session.sessionStatus = 'ended_death';
    await repo.save(session);

    if (session.activeCombatEncounterId) {
        await endPenaiCombat(sessionId, session.activeCombatEncounterId, 'defeat');
    }

    const heroId = session.heroWorldEntityId;
    let heroName = 'Herói';
    let level = 1;
    if (heroId) {
        const hero = await PenaiDataSource.getRepository(WorldEntity).findOne({
            where: { id: heroId },
        });
        heroName = hero?.displayName ?? heroName;
        const build = (hero?.stats?.srdBuild ?? {}) as Record<string, unknown>;
        level = typeof build.level === 'number' ? build.level : 1;
        const stats = await loadHeroSessionStats(sessionId, heroId);
        if (stats.heroStatus !== 'dead') {
            await saveHeroSessionStats(sessionId, heroId, {
                ...stats,
                hp: 0,
                heroStatus: 'dead',
                deathSaves: { successes: stats.deathSaves.successes, failures: 3 },
                conditions: stats.conditions.filter(c => c !== 'unconscious'),
            });
        }
    }

    await appendWorldEvent({
        type: 'HERO_PERMANENTLY_DEAD',
        sessionId,
        actorEntityId: heroId ?? undefined,
        payload: { heroName, level, vaultTemplateId: session.vaultTemplateId },
    });

    penaiPipelineLog('MOTOR', 'herói morreu permanentemente', { heroName, level }, { sessionId });

    if (userId) {
        await publishWsToUser(userId, {
            type: 'heroPermanentlyDead',
            contractVersion: 2,
            sessionId,
            locale: 'pt-BR',
            heroName,
            level,
            vaultTemplateId: session.vaultTemplateId,
            reason: 'Três falhas nos testes de morte.',
        });
    }
}

export async function tryOfferDeathSaveRoll(
    sessionId: number,
    userId: number,
    opts: { actionId: string; actionSequence: number },
): Promise<PlayerRollRequest | null> {
    const stats = await getHeroVitals(sessionId);
    if (!stats || !needsDeathSaveRoll(statsToVitals(stats))) return null;
    return buildDeathSaveRollRequest(sessionId, opts);
}
