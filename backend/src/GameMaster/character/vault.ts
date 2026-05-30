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

    await appendWorldEvent({
        type: 'HERO_CREATED',
        sessionId,
        actorEntityId: newId,
        payload: { displayName: template.displayName, fromVaultTemplate: templateId },
    });

    return newId;
}
