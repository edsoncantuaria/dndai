// backend/src/controllers/aiController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as AiCreationService from '../services/aiCreationService.js';
import createError from 'http-errors';
import { z } from 'zod';
import { listCachedEnemyTemplates, refreshEnemyTemplatesFromDatabase } from '../services/enemyTemplateRegistry.js';
import { AppDataSource } from '../database/data-source.js';
import { EnemyTemplate as EnemyTemplateEntity } from '../entities/EnemyTemplate.js';
import { normalizeTemplateSlug } from '../data/enemyTemplates.js';

const ALLOWED_TYPES = ['race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat', 'skill', 'translation'] as const;

const homebrewRequestSchema = z.object({
    prompt: z.string().min(1, 'Prompt é obrigatório.'),
    type: z.enum(ALLOWED_TYPES, { errorMap: () => ({ message: 'Tipo de conteúdo inválido.' }) }),
    apiKey: z.string().min(8, 'Chave de API inválida.'),
});

export const createHomebrew = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'Usuário não autenticado.'));
    }

    try {
        const validation = homebrewRequestSchema.safeParse(req.body);
        if (!validation.success) {
            return next(createError(400, 'Dados inválidos para criação de homebrew.', { details: validation.error.flatten() }));
        }
        const { prompt, type, apiKey } = validation.data;
        
        const result = await AiCreationService.generateHomebrewContent({ prompt, type, apiKey });
        
        if (result && result.content) {
            res.status(200).json(result);
        } else {
            throw createError(500, "A IA não conseguiu gerar o conteúdo solicitado.");
        }

    } catch (error) {
        next(error);
    }
};

export const listEnemyTemplates = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (AppDataSource.isInitialized) {
            await refreshEnemyTemplatesFromDatabase();
        }
        const templates = listCachedEnemyTemplates();
        res.json({ templates });
    } catch (error) {
        next(error);
    }
};

const enemyTemplateSchema = z.object({
    name: z.string().min(1),
    slug: z.string().optional(),
    stats: z.object({
        str: z.number().optional(),
        dex: z.number().optional(),
        con: z.number().optional(),
        int: z.number().optional(),
        wis: z.number().optional(),
        cha: z.number().optional(),
    }).partial().optional(),
    hitPoints: z.number().int().positive().optional(),
    armorClass: z.number().int().positive().optional(),
    actionPoints: z.number().int().nonnegative().optional(),
    bonusActionPoints: z.number().int().nonnegative().optional(),
    damageProfile: z.object({
        dice: z.string(),
        type: z.string().optional(),
        average: z.number().optional(),
        notes: z.string().optional(),
    }).partial().optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
});

export const createEnemyTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const parsed = enemyTemplateSchema.safeParse(req.body);
        if (!parsed.success) {
            return next(createError(400, 'Payload inválido para template de inimigo.', { details: parsed.error.flatten() }));
        }
        if (!AppDataSource.isInitialized) {
            return next(createError(503, 'Banco de dados indisponível para criar templates.'));
        }
        const data = parsed.data;
        const repo = AppDataSource.getRepository(EnemyTemplateEntity);
        const slug = normalizeTemplateSlug(data.slug ?? data.name);
        if (!slug) {
            return next(createError(400, 'Não foi possível gerar um slug para o template.'));
        }
        const existing = await repo.findOne({ where: { slug } });
        if (existing) {
            return next(createError(409, 'Já existe um template com esse slug.'));
        }
        const entity = repo.create({
            name: data.name,
            slug,
            stats: data.stats ?? null,
            hitPoints: data.hitPoints ?? null,
            armorClass: data.armorClass ?? null,
            actionPoints: data.actionPoints ?? null,
            bonusActionPoints: data.bonusActionPoints ?? null,
            damageProfile: data.damageProfile ?? null,
            tags: data.tags ?? null,
            description: data.description ?? null,
        });
        await repo.save(entity);
        await refreshEnemyTemplatesFromDatabase();
        res.status(201).json({ template: entity });
    } catch (error) {
        next(error);
    }
};

export const updateEnemyTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const slugParam = normalizeTemplateSlug(req.params.slug);
        if (!slugParam) {
            return next(createError(400, 'Slug inválido.'));
        }
        const parsed = enemyTemplateSchema.partial().safeParse(req.body);
        if (!parsed.success) {
            return next(createError(400, 'Payload inválido para atualização.', { details: parsed.error.flatten() }));
        }
        if (!AppDataSource.isInitialized) {
            return next(createError(503, 'Banco de dados indisponível para atualizar templates.'));
        }
        const repo = AppDataSource.getRepository(EnemyTemplateEntity);
        const existing = await repo.findOne({ where: { slug: slugParam } });
        if (!existing) {
            return next(createError(404, 'Template não encontrado.'));
        }
        const data = parsed.data;
        if (data.name) existing.name = data.name;
        if (data.stats) existing.stats = data.stats;
        if (data.hitPoints !== undefined) existing.hitPoints = data.hitPoints;
        if (data.armorClass !== undefined) existing.armorClass = data.armorClass;
        if (data.actionPoints !== undefined) existing.actionPoints = data.actionPoints;
        if (data.bonusActionPoints !== undefined) existing.bonusActionPoints = data.bonusActionPoints;
        if (data.damageProfile !== undefined) existing.damageProfile = data.damageProfile;
        if (data.tags !== undefined) existing.tags = data.tags;
        if (data.description !== undefined) existing.description = data.description;
        await repo.save(existing);
        await refreshEnemyTemplatesFromDatabase();
        res.json({ template: existing });
    } catch (error) {
        next(error);
    }
};

export const deleteEnemyTemplate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const slugParam = normalizeTemplateSlug(req.params.slug);
        if (!slugParam) {
            return next(createError(400, 'Slug inválido.'));
        }
        if (!AppDataSource.isInitialized) {
            return next(createError(503, 'Banco de dados indisponível para remover templates.'));
        }
        const repo = AppDataSource.getRepository(EnemyTemplateEntity);
        const existing = await repo.findOne({ where: { slug: slugParam } });
        if (!existing) {
            return next(createError(404, 'Template não encontrado.'));
        }
        await repo.remove(existing);
        await refreshEnemyTemplatesFromDatabase();
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};
