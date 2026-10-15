import { randomUUID } from 'crypto';
import createError from 'http-errors';
import type { z } from 'zod';
import { IsNull } from 'typeorm';
import { PenaiDataSource } from '../database/data-source.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import type { NewCharacterInfoSchema } from '../../schemas/validationSchemas.js';
import { ensureHeroSessionState } from './heroStats.js';
import { seedStarterInventory, addHeroInventoryItem } from './heroInventory.js';
import { appendWorldEvent } from '../events/store.js';
import { validateCreationAttributes } from './validateCreationAttributes.js';

function slugify(name: string, userId: number): string {
    const base = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return `${base}-vault-${userId}`;
}

function vaultToListItem(entity: WorldEntity): Record<string, unknown> {
    const build = (entity.stats?.srdBuild ?? {}) as Record<string, unknown>;
    return {
        id: entity.id,
        name: entity.displayName,
        race: build.race ?? null,
        characterClass: build.characterClass ?? null,
        level: (build.level as number) ?? 1,
        isTemplate: true,
        engine: 'penai',
        createdAt: entity.createdAt.toISOString(),
    };
}

function vaultToFullCharacter(entity: WorldEntity): Record<string, unknown> {
    const build = (entity.stats?.srdBuild ?? {}) as Record<string, unknown>;
    const attrs = (build.attributes ?? {}) as Record<string, unknown>;
    return {
        id: entity.id,
        name: entity.displayName,
        ...build,
        attributes: attrs,
        isTemplate: true,
        engine: 'penai',
    };
}

export async function createVaultHero(
    userId: number,
    data: z.infer<typeof NewCharacterInfoSchema>,
): Promise<Record<string, unknown>> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const id = randomUUID();
    const srdBuild = {
        ...data,
        level: data.level ?? 1,
    };

    const entity = await repo.save(
        repo.create({
            id,
            entityType: 'hero',
            canonical: true,
            isVaultTemplate: true,
            slug: slugify(data.name, userId),
            displayName: data.name,
            description: data.backstory?.slice(0, 500) || 'Herói do cofre.',
            stats: {
                level: data.level ?? 1,
                strength: data.attributes.strength,
                dexterity: data.attributes.dexterity,
                constitution: data.attributes.constitution,
                intelligence: data.attributes.intelligence,
                wisdom: data.attributes.wisdom,
                charisma: data.attributes.charisma,
                srdBuild,
            },
            personality: {
                ideal: data.ideal,
                bond: data.bond,
                flaw: data.flaw,
                traits: data.personalityTraits,
            },
            visual: {
                sex: data.sex,
                hairStyle: data.hairStyle,
                beardStyle: data.beardStyle,
                skinColor: data.skinColor,
            },
            createdByUserId: userId,
            source: 'srd',
            locale: 'pt-BR',
        }),
    );

    return vaultToFullCharacter(entity);
}

export async function listVaultHeroes(userId: number): Promise<Record<string, unknown>[]> {
    const entities = await PenaiDataSource.getRepository(WorldEntity).find({
        where: {
            createdByUserId: userId,
            isVaultTemplate: true,
            deletedAt: IsNull(),
            entityType: 'hero',
        },
        order: { updatedAt: 'DESC' },
    });
    return entities.map(vaultToListItem);
}

export async function getVaultHero(
    userId: number,
    heroId: string,
): Promise<Record<string, unknown> | null> {
    const entity = await PenaiDataSource.getRepository(WorldEntity).findOne({
        where: {
            id: heroId,
            createdByUserId: userId,
            isVaultTemplate: true,
            deletedAt: IsNull(),
        },
    });
    if (!entity) return null;
    return vaultToFullCharacter(entity);
}

/** Atualiza template do cofre — campanhas já iniciadas mantêm cópia congelada na sessão. */
export async function updateVaultHero(
    userId: number,
    heroId: string,
    data: z.infer<typeof NewCharacterInfoSchema>,
): Promise<Record<string, unknown>> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const entity = await repo.findOne({
        where: {
            id: heroId,
            createdByUserId: userId,
            isVaultTemplate: true,
            deletedAt: IsNull(),
        },
    });
    if (!entity) throw createError(404, 'Template de herói não encontrado no cofre.');

    await validateCreationAttributes(userId, data);

    const prevRevision = (entity.stats?.templateRevision as number) ?? 1;
    const srdBuild = { ...data, level: data.level ?? 1 };

    entity.displayName = data.name;
    entity.description = data.backstory?.slice(0, 500) || entity.description;
    entity.stats = {
        ...entity.stats,
        templateRevision: prevRevision + 1,
        level: data.level ?? 1,
        strength: data.attributes.strength,
        dexterity: data.attributes.dexterity,
        constitution: data.attributes.constitution,
        intelligence: data.attributes.intelligence,
        wisdom: data.attributes.wisdom,
        charisma: data.attributes.charisma,
        srdBuild,
    };
    entity.personality = {
        ideal: data.ideal,
        bond: data.bond,
        flaw: data.flaw,
        traits: data.personalityTraits,
    };
    entity.visual = {
        sex: data.sex,
        hairStyle: data.hairStyle,
        beardStyle: data.beardStyle,
        skinColor: data.skinColor,
    };
    await repo.save(entity);
    return vaultToFullCharacter(entity);
}

export async function deleteVaultHero(userId: number, heroId: string): Promise<boolean> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const entity = await repo.findOne({
        where: { id: heroId, createdByUserId: userId, isVaultTemplate: true },
    });
    if (!entity) return false;
    entity.deletedAt = new Date();
    await repo.save(entity);
    return true;
}

export async function cloneVaultHeroToSession(
    sessionId: number,
    userId: number,
    templateId: string,
): Promise<string> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const template = await repo.findOne({
        where: {
            id: templateId,
            createdByUserId: userId,
            isVaultTemplate: true,
            deletedAt: IsNull(),
        },
    });
    if (!template) throw createError(404, 'Template de herói não encontrado no cofre.');

    // Snapshot imutável: herói da sessão é entidade separada (isVaultTemplate=false).
    const build = (template.stats?.srdBuild ?? {}) as Record<string, unknown>;
    const attrs = (build.attributes ?? template.stats) as Record<string, unknown>;
    const newId = randomUUID();

    await repo.save(
        repo.create({
            id: newId,
            entityType: 'hero',
            canonical: true,
            isVaultTemplate: false,
            slug: `${template.slug}-s${sessionId}`.slice(0, 120),
            displayName: template.displayName,
            description: template.description,
            stats: {
                ...template.stats,
                level: (build.level as number) ?? template.stats?.level ?? 1,
                strength: attrs.strength ?? template.stats?.strength,
                dexterity: attrs.dexterity ?? template.stats?.dexterity,
                constitution: attrs.constitution ?? template.stats?.constitution,
                intelligence: attrs.intelligence ?? template.stats?.intelligence,
                wisdom: attrs.wisdom ?? template.stats?.wisdom,
                charisma: attrs.charisma ?? template.stats?.charisma,
            },
            personality: template.personality,
            visual: template.visual,
            createdByUserId: userId,
            source: template.source,
            locale: template.locale,
        }),
    );

    await ensureHeroSessionState(sessionId, newId);
    const inv = (build.inventory as Array<{ index?: string; name?: string; quantity?: number }>) ?? [];
    if (inv.length > 0) {
        for (const item of inv) {
            const key = item.index ?? item.name ?? 'item';
            await addHeroInventoryItem({
                sessionId,
                heroEntityId: newId,
                itemKey: key,
                name: item.name ?? key,
                quantity: item.quantity ?? 1,
                itemData: item as Record<string, unknown>,
            });
        }
    } else {
        await seedStarterInventory(sessionId, newId);
    }

    const sessionRepo = PenaiDataSource.getRepository(
        (await import('../database/entities/GameSession.js')).GameSession,
    );
    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (session) {
        session.vaultTemplateId = templateId;
        await sessionRepo.save(session);
    }

    await appendWorldEvent({
        type: 'HERO_CREATED',
        sessionId,
        actorEntityId: newId,
        payload: { displayName: template.displayName, fromVaultTemplate: templateId },
    });

    return newId;
}

/** Exporta progresso do herói da sessão para o template do cofre (pós-morte ou manual). */
export async function exportSessionHeroToVault(
    userId: number,
    sessionId: number,
): Promise<Record<string, unknown>> {
    const { GameSession } = await import('../database/entities/GameSession.js');
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId, userId },
    });
    if (!session?.heroWorldEntityId) {
        throw createError(404, 'Herói da sessão não encontrado.');
    }

    const templateId = session.vaultTemplateId;
    if (!templateId) {
        throw createError(400, 'Sessão sem template de cofre vinculado.');
    }

    const repo = PenaiDataSource.getRepository(WorldEntity);
    const template = await repo.findOne({
        where: { id: templateId, createdByUserId: userId, isVaultTemplate: true, deletedAt: IsNull() },
    });
    if (!template) throw createError(404, 'Template do cofre não encontrado.');

    const hero = await repo.findOne({ where: { id: session.heroWorldEntityId } });
    if (!hero) throw createError(404, 'Entidade do herói não encontrada.');

    const { loadHeroSessionStats } = await import('./heroStats.js');
    const { listHeroInventory } = await import('./heroInventory.js');
    const { loadPenaiProgressionPack } = await import('./progressionPack.js');

    const stats = await loadHeroSessionStats(sessionId, hero.id);
    const inventory = await listHeroInventory(sessionId, hero.id);
    const srdBuild = { ...((hero.stats?.srdBuild ?? {}) as Record<string, unknown>) };
    const progression = await loadPenaiProgressionPack({
        sessionId,
        heroEntityId: hero.id,
        srdBuild,
    });

    srdBuild.level = progression.level;
    srdBuild.inventory = inventory.map(i => ({
        index: i.itemKey,
        name: i.name,
        quantity: i.quantity,
        equipped: i.equipped,
    }));
    if (progression.classLevelsData?.length) {
        srdBuild.classLevelsData = progression.classLevelsData;
    }
    if (progression.subclassLevelsData?.length) {
        srdBuild.subclassLevelsData = progression.subclassLevelsData;
    }

    template.displayName = hero.displayName;
    template.stats = {
        ...hero.stats,
        ...template.stats,
        level: progression.level,
        srdBuild,
        exportedFromSessionId: sessionId,
        exportedAt: new Date().toISOString(),
        sessionHp: stats.hp,
        sessionMaxHp: stats.maxHp,
    };

    await repo.save(template);

    await appendWorldEvent({
        type: 'HERO_EXPORTED_TO_VAULT',
        sessionId,
        actorEntityId: hero.id,
        payload: { vaultTemplateId: templateId, level: progression.level },
    });

    return vaultToFullCharacter(template);
}

/** Reseta progresso do template para nível 1 (mesma identidade/backstory). */
export async function resetVaultHeroProgress(
    userId: number,
    heroId: string,
): Promise<Record<string, unknown>> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const entity = await repo.findOne({
        where: { id: heroId, createdByUserId: userId, isVaultTemplate: true, deletedAt: IsNull() },
    });
    if (!entity) throw createError(404, 'Template de herói não encontrado no cofre.');

    const build = { ...((entity.stats?.srdBuild ?? {}) as Record<string, unknown>) };
    build.level = 1;
    delete build.classLevelsData;
    delete build.subclassLevelsData;
    delete build.exportedFromSessionId;
    delete build.exportedAt;
    delete build.sessionHp;
    delete build.sessionMaxHp;

    entity.stats = {
        ...entity.stats,
        level: 1,
        srdBuild: build,
        templateRevision: ((entity.stats?.templateRevision as number) ?? 1) + 1,
    };

    await repo.save(entity);
    return vaultToFullCharacter(entity);
}
