import { randomUUID } from 'crypto';
import { In } from 'typeorm';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionInstalledModule } from '../database/entities/SessionInstalledModule.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { appendWorldEvent } from '../events/store.js';
import { penaiEnv } from '../../config/penaiEnv.js';
import { ensureHeroSessionState } from '../character/heroStats.js';
import { seedStarterInventory } from '../character/heroInventory.js';
import { defaultGameClock } from '../world/gameClock.js';
import { cloneVaultHeroToSession } from '../character/vault.js';
import {
    ensureUserHasSrdPtBrBundle,
    getSrdPtBrCoreBundleId,
    SRD_PTBR_CORE_BUNDLE_NAME,
} from '../database/seed/seedSrdPtBrHomebrew.js';
import { resolveSessionSpawnSlug } from '../world/penaiSpawnPool.js';
import { discoverFactionsByRegion } from '../world/factionDiscovery.js';
import { penaiPipelineLog } from '../infra/pipelineLog.js';
import { initWorldBootstrapPending } from './sessionUiState.js';

const SRD_PTBR_CORE = SRD_PTBR_CORE_BUNDLE_NAME;

export async function createGameSession(opts: {
    userId: number;
    nome: string;
    heroName?: string;
    heroWorldEntityId?: string;
    /** Slug de cidade do spawn pool; omitido = sorteio entre cidades `spawnTier: intro`. */
    spawnRegionSlug?: string;
}): Promise<Record<string, unknown>> {
    const sessionRepo = PenaiDataSource.getRepository(GameSession);
    const moduleRepo = PenaiDataSource.getRepository(SessionInstalledModule);

    penaiPipelineLog('SESSION', 'criando sessão…', {
        userId: opts.userId,
        nome: opts.nome,
        heroName: opts.heroName,
    });

    const spawn = await resolveSessionSpawnSlug(opts.spawnRegionSlug);

    const session = await sessionRepo.save(
        sessionRepo.create({
            userId: opts.userId,
            nome: opts.nome,
            locale: penaiEnv.DEFAULT_LOCALE,
            currentRegionSlug: spawn.slug,
            gameClock: defaultGameClock() as unknown as Record<string, unknown>,
        }),
    );

    await moduleRepo.save(
        moduleRepo.create({
            sessionId: session.id,
            moduleId: SRD_PTBR_CORE,
            version: '1.0.0',
            kind: 'translation',
            payload: {
                locale: 'pt-BR',
                label: 'SRD Tradução Core',
                bundleId: (await getSrdPtBrCoreBundleId()) ?? undefined,
            },
        }),
    );

    await ensureUserHasSrdPtBrBundle(opts.userId);

    if (opts.heroWorldEntityId) {
        const heroId = await cloneVaultHeroToSession(
            session.id,
            opts.userId,
            opts.heroWorldEntityId,
        );
        session.heroWorldEntityId = heroId;
        await sessionRepo.save(session);
    } else if (opts.heroName) {
        const heroId = await createHeroForSession(session.id, opts.userId, opts.heroName);
        session.heroWorldEntityId = heroId;
        await sessionRepo.save(session);
    }

    await discoverFactionsByRegion(session.id, spawn.slug);

    const { assignSessionShard } = await import('../world/shardResolver.js');
    await assignSessionShard(session.id, spawn.slug);

    await appendWorldEvent({
        type: 'SESSION_CREATED',
        sessionId: session.id,
        payload: {
            nome: opts.nome,
            locale: 'pt-BR',
            spawnRegionSlug: spawn.slug,
            spawnRegionName: spawn.displayName,
            spawnTier: spawn.tier,
        },
    });

    penaiPipelineLog(
        'SESSION',
        'sessão criada — aguardando narração de abertura',
        {
            spawnRegionSlug: spawn.slug,
            spawnRegionName: spawn.displayName,
            heroWorldEntityId: session.heroWorldEntityId,
        },
        { sessionId: session.id, userId: opts.userId },
    );

    void import('../../temporal/client.js').then(({ startWorldBootstrapWorkflow }) =>
        startWorldBootstrapWorkflow(session.id).catch(err => {
            penaiPipelineLog(
                'WORLD_BOOTSTRAP',
                'agendamento na criação falhou',
                { error: err instanceof Error ? err.message : String(err) },
                { sessionId: session.id, userId: opts.userId },
            );
        }),
    );

    return formatSession(session);
}

async function createHeroForSession(
    sessionId: number,
    userId: number,
    heroName: string,
): Promise<string> {
    const entityRepo = PenaiDataSource.getRepository(WorldEntity);
    const slug = heroName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const id = randomUUID();
    await entityRepo.save(
        entityRepo.create({
            id,
            entityType: 'hero',
            canonical: true,
            slug: `${slug}-${userId}`,
            displayName: heroName,
            description: `Herói criado pelo jogador.`,
            stats: {
                level: 1,
                strength: 14,
                dexterity: 12,
                constitution: 14,
                intelligence: 10,
                wisdom: 10,
                charisma: 10,
                weaponProficiencies: ['shortsword'],
            },
            personality: {},
            visual: {},
            createdByUserId: userId,
            source: 'ai_generated',
            locale: 'pt-BR',
        }),
    );

    await ensureHeroSessionState(sessionId, id);
    await seedStarterInventory(sessionId, id);

    await appendWorldEvent({
        type: 'HERO_CREATED',
        sessionId,
        actorEntityId: id,
        payload: { displayName: heroName, starterGear: true },
    });

    await appendWorldEvent({
        type: 'HERO_EQUIPPED',
        sessionId,
        actorEntityId: id,
        payload: { items: ['shortsword', 'healing-potion'] },
    });

    return id;
}

export async function getGameSession(id: number): Promise<Record<string, unknown> | null> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({ where: { id } });
    if (!session) return null;
    return formatSession(session);
}

export async function listGameSessions(userId: number): Promise<Record<string, unknown>[]> {
    const sessions = await PenaiDataSource.getRepository(GameSession).find({
        where: { userId },
        order: { updatedAt: 'DESC' },
    });
    const heroIds = sessions.map(s => s.heroWorldEntityId).filter((id): id is string => Boolean(id));
    const heroes =
        heroIds.length > 0
            ? await PenaiDataSource.getRepository(WorldEntity).find({ where: { id: In(heroIds) } })
            : [];
    const heroById = new Map(heroes.map(h => [h.id, h]));
    return sessions.map(s => formatSession(s, heroById.get(s.heroWorldEntityId ?? '')));
}

function heroSummaryFromEntity(hero?: WorldEntity): { heroName?: string; heroRace?: string; heroClass?: string } {
    if (!hero) return {};
    const build = (hero.stats?.srdBuild ?? {}) as Record<string, unknown>;
    return {
        heroName: hero.displayName,
        heroRace: typeof build.race === 'string' ? build.race : undefined,
        heroClass: typeof build.characterClass === 'string' ? build.characterClass : undefined,
    };
}

function formatSession(s: GameSession, hero?: WorldEntity): Record<string, unknown> {
    const heroSummary = heroSummaryFromEntity(hero);
    const bootstrap = s.worldBootstrap as { status?: string } | null;
    return {
        id: s.id,
        userId: s.userId,
        nome: s.nome,
        locale: s.locale,
        stateVersion: s.stateVersion,
        actionSequence: s.actionSequence,
        actionCursor: s.actionCursor,
        heroWorldEntityId: s.heroWorldEntityId,
        heroName: heroSummary.heroName,
        heroRace: heroSummary.heroRace,
        heroClass: heroSummary.heroClass,
        currentRegionSlug: s.currentRegionSlug,
        worldBootstrapStatus: bootstrap?.status ?? 'pending',
        contractVersion: 2,
        engine: 'penai',
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
    };
}

export async function allocateActionSequence(sessionId: number): Promise<number> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) throw new Error('Sessão não encontrada');
    session.actionSequence += 1;
    await repo.save(session);
    return session.actionSequence;
}

export async function renameGameSessionPenai(
    sessionId: number,
    userId: number,
    nome: string,
): Promise<Record<string, unknown> | null> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId, userId } });
    if (!session) return null;
    session.nome = nome.trim().slice(0, 100);
    await repo.save(session);
    return formatSession(session);
}

export async function deleteGameSessionPenai(sessionId: number, userId: number): Promise<boolean> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const result = await repo.delete({ id: sessionId, userId });
    return (result.affected ?? 0) > 0;
}
