import { randomUUID } from 'crypto';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionInstalledModule } from '../database/entities/SessionInstalledModule.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { appendWorldEvent } from '../events/store.js';
import { penaiEnv } from '../../config/penaiEnv.js';
import { ensureHeroSessionState } from '../character/heroStats.js';
import { seedStarterInventory } from '../character/heroInventory.js';
import { defaultGameClock } from '../world/gameClockPenai.js';
import { cloneVaultHeroToSession } from '../character/heroVaultPenai.js';

const SRD_PTBR_CORE = 'srd-ptbr-core';

export async function createGameSession(opts: {
    userId: number;
    nome: string;
    heroName?: string;
    heroWorldEntityId?: string;
}): Promise<Record<string, unknown>> {
    const sessionRepo = PenaiDataSource.getRepository(GameSession);
    const moduleRepo = PenaiDataSource.getRepository(SessionInstalledModule);

    const session = await sessionRepo.save(
        sessionRepo.create({
            userId: opts.userId,
            nome: opts.nome,
            locale: penaiEnv.DEFAULT_LOCALE,
            currentRegionSlug: 'cidadela-do-acoluz',
            gameClock: defaultGameClock() as unknown as Record<string, unknown>,
        }),
    );

    await moduleRepo.save(
        moduleRepo.create({
            sessionId: session.id,
            moduleId: SRD_PTBR_CORE,
            version: '1.0.0',
            kind: 'translation',
            payload: { locale: 'pt-BR', label: 'SRD Tradução Core' },
        }),
    );

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

    await appendWorldEvent({
        type: 'SESSION_CREATED',
        sessionId: session.id,
        payload: { nome: opts.nome, locale: 'pt-BR' },
    });

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
    return sessions.map(formatSession);
}

function formatSession(s: GameSession): Record<string, unknown> {
    return {
        id: s.id,
        userId: s.userId,
        nome: s.nome,
        locale: s.locale,
        stateVersion: s.stateVersion,
        actionSequence: s.actionSequence,
        actionCursor: s.actionCursor,
        heroWorldEntityId: s.heroWorldEntityId,
        currentRegionSlug: s.currentRegionSlug,
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
