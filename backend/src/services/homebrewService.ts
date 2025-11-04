// backend/src/services/homebrewService.ts
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { HomebrewBundle } from '../entities/HomebrewBundle.js';
import { User } from '../entities/User.js';
import createError from 'http-errors';
import type { z } from 'zod';
import type { CreateHomebrewSchema, CreateBundleSchema, UpdateBundleSchema } from '../schemas/validationSchemas.js';
import { FindManyOptions, In, Like, IsNull, Not } from 'typeorm';

interface PaginationOptions {
    page: number;
    limit: number;
}

export const createHomebrewContent = async (authorId: number, data: z.infer<typeof CreateHomebrewSchema>) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);

    // Se for uma tradução, a 'name' é a categoria, que deve ser única por autor.
    if (data.type === 'translation') {
        const existing = await homebrewRepo.findOne({ where: { type: 'translation', name: data.name, authorId } });
        if (existing) {
            // Se já existe, atualizamos o conteúdo em vez de criar um novo.
            existing.content = data.content;
            return await homebrewRepo.save(existing);
        }
    }

    const newContent = new HomebrewContent();
    newContent.authorId = authorId;
    newContent.type = data.type;
    newContent.name = data.name;
    
    const contentPayload = { ...data.content };
    if (!contentPayload.index && data.type !== 'translation') {
        contentPayload.index = data.name.toLowerCase().replace(/\s+/g, '-') || `custom-${data.type}-${Date.now()}`;
    }
    
    newContent.content = contentPayload;
    newContent.isPublic = data.isPublic || false;
    newContent.createdBy = data.createdBy || 'user';
    newContent.dependencies = data.dependencies || [];
    
    try {
        const savedContent = await homebrewRepo.save(newContent);
        return savedContent;
    } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw createError(409, `Um conteúdo com o nome "${data.name}" ou índice derivado já existe.`);
        }
        console.error("Erro ao salvar conteúdo homebrew:", error);
        throw createError(500, 'Falha ao salvar o conteúdo no banco de dados.');
    }
};

export const updateHomebrewContent = async (contentId: string, authorId: number, data: z.infer<typeof CreateHomebrewSchema>) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const contentToUpdate = await homebrewRepo.findOneBy({ id: contentId });

    if (!contentToUpdate) {
        throw createError(404, 'Conteúdo Homebrew não encontrado.');
    }
    if (contentToUpdate.authorId !== authorId && authorId !== 1) {
        throw createError(403, 'Você não tem permissão para editar este conteúdo.');
    }
    if (contentToUpdate.createdBy === 'ai' && authorId !== 1) {
        throw createError(403, 'Conteúdo gerado pela IA não pode ser editado.');
    }
    if (contentToUpdate.bundleId && authorId !== 1) {
        throw createError(409, 'Este conteúdo não pode ser editado pois pertence a um pacote. Remova-o do pacote para editar.');
    }

    contentToUpdate.name = data.name;
    contentToUpdate.content = data.content;
    contentToUpdate.isPublic = data.isPublic || false;
    contentToUpdate.dependencies = data.dependencies || [];

    try {
        return await homebrewRepo.save(contentToUpdate);
    } catch (error: any) {
        console.error("Erro ao atualizar conteúdo homebrew:", error);
        throw createError(500, 'Falha ao atualizar o conteúdo no banco de dados.');
    }
};

export const deleteHomebrewContent = async (contentId: string, authorId: number) => {
    throw createError(403, 'A exclusão de criações individuais está desabilitada.');
};

export const getPublicHomebrewContent = async (type?: HomebrewContentType, createdBy?: 'user' | 'ai', pagination?: PaginationOptions) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const whereCondition: FindManyOptions<HomebrewContent>['where'] = { 
        isPublic: true,
    };
    const { page = 1, limit = 100 } = pagination || {};

    if (type) whereCondition.type = type;
    if (createdBy) whereCondition.createdBy = createdBy;

    return homebrewRepo.find({
        where: whereCondition,
        relations: ['bundle', 'author'],
        select: {
            id: true, name: true, type: true, authorId: true, createdAt: true, createdBy: true, isPublic: true, content: true, bundleId: true,
            author: { id: true, username: true }
        },
        take: limit,
        skip: (page - 1) * limit,
    });
};

export const getPrivateHomebrewContentForUser = async (authorId: number, type?: HomebrewContentType) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const whereCondition: FindManyOptions<HomebrewContent>['where'] = { authorId, isPublic: false };
    if (type) whereCondition.type = type;

    return homebrewRepo.find({ where: whereCondition });
};


export const getHomebrewContentByAuthor = async (authorId: number, type?: HomebrewContentType, pagination?: PaginationOptions) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const whereCondition: FindManyOptions<HomebrewContent>['where'] = { authorId };
    const { page = 1, limit = 100 } = pagination || {};
    if (type) whereCondition.type = type;

    return homebrewRepo.find({
        where: whereCondition,
        relations: ['bundle', 'author'],
        select: {
            id: true, name: true, type: true, authorId: true, createdAt: true, createdBy: true, isPublic: true, content: true, bundleId: true,
            author: { id: true, username: true }
        },
        take: limit,
        skip: (page - 1) * limit,
    });
};

export const getHomebrewContentById = async (contentId: string, userId?: number) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const content = await homebrewRepo.findOneBy({ id: contentId });
    if (!content) throw createError(404, 'Conteúdo Homebrew não encontrado.');
    if (!content.isPublic && content.authorId !== userId && userId !== 1) throw createError(403, 'Você não tem permissão para visualizar este conteúdo.');
    return content;
};

export const getMultipleHomebrewContentByIds = async (contentIds: string[], type?: HomebrewContentType): Promise<HomebrewContent[]> => {
    if (contentIds.length === 0) return [];
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const whereCondition: FindManyOptions<HomebrewContent>['where'] = { id: In(contentIds) };
    if (type) whereCondition.type = type;
    return homebrewRepo.find({ where: whereCondition });
};

// Esta função não é mais necessária com a nova lógica do unifiedDataService
// e foi removida para evitar confusão.

export const findAdminTranslation = async (officialIndex: string, type: HomebrewContentType): Promise<HomebrewContent | null> => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    
    const query = homebrewRepo.createQueryBuilder("hb");

     if (type === 'translation') {
        query.where("hb.type = 'translation'")
             .andWhere("hb.authorId = 1")
             .andWhere("hb.name = :name", { name: officialIndex });
    } else {
        query.where("hb.type = :type", { type })
             .andWhere("hb.authorId = 1")
             .andWhere("JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.official_index')) = :index", { index: officialIndex });
    }

    return query.getOne();
}

export const getAdminTranslations = async (type: HomebrewContentType): Promise<HomebrewContent[]> => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    return homebrewRepo.find({
        where: {
            authorId: 1, // Admin user ID
            type: type,
            content: Like('%"official_index"%'), // Garante que o campo existe
        },
    });
};


export const getHomebrewDependencies = async (contentId: string, visited = new Set<string>()): Promise<HomebrewContent[]> => {
    if (visited.has(contentId)) return [];
    visited.add(contentId);
    const repo = AppDataSource.getRepository(HomebrewContent);
    const content = await repo.findOne({ where: { id: contentId }, relations: ['bundle', 'bundle.contents'] });
    if (!content) return [];
    const bundleDependencies = content.bundle ? content.bundle.contents.filter(c => c.id !== content.id) : [];
    const allDependencies = [content, ...bundleDependencies];
    const allDependencyIds = new Set([...(content.dependencies || []), ...bundleDependencies.flatMap(c => c.dependencies || [])]);
    if (allDependencyIds.size > 0) {
        for (const depId of allDependencyIds) {
            const nestedDependencies = await getHomebrewDependencies(depId, visited);
            allDependencies.push(...nestedDependencies);
        }
    }
    return Array.from(new Map(allDependencies.map(item => [item.id, item])).values());
};

export const checkIfNameExists = async (name: string, type: HomebrewContentType): Promise<{ exists: boolean }> => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const index = name.toLowerCase().replace(/\s+/g, '-');
    const count = await homebrewRepo.count({
        where: [{ type, name: Like(name) }, { type, content: Like(`%"index":"${index}"%`) }]
    });
    return { exists: count > 0 };
};

// --- Bundle Functions ---
export const getBundles = async (options: { userId?: number; scope?: 'public' | 'mine'; page: number; limit: number }) => {
    const { userId, scope, page, limit } = options;
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const query = bundleRepo.createQueryBuilder('bundle')
        .leftJoinAndSelect('bundle.author', 'author')
        .leftJoinAndSelect('bundle.contents', 'contents') // Carrega o conteúdo completo
        .loadRelationCountAndMap('bundle.contentCount', 'bundle.contents')
        .take(limit)
        .skip((page - 1) * limit);

    if (scope === 'mine' && userId) {
        query.where('bundle.authorId = :userId', { userId });
    }
    else {
        query.where('bundle.isPublic = true');
    }
    
    return query.getMany();
};

export const getContentsOfBundle = async (bundleId: string): Promise<HomebrewContent[]> => {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const bundle = await bundleRepo.findOne({
        where: { id: bundleId },
        relations: ['contents']
    });
    if (!bundle) throw createError(404, 'Pacote não encontrado.');
    return bundle.contents;
};

export const createBundle = async (authorId: number, data: z.infer<typeof CreateBundleSchema>) => {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const contentRepo = AppDataSource.getRepository(HomebrewContent);
    const contents = await contentRepo.find({ where: { id: In(data.contentIds), authorId } });
    if (contents.length !== data.contentIds.length) throw createError(403, 'Um ou mais itens de conteúdo não foram encontrados ou você não tem permissão para usá-los.');
    const contentAlreadyInBundle = await contentRepo.count({ where: { id: In(data.contentIds), bundleId: Not(IsNull()) } });
    if (contentAlreadyInBundle > 0) throw createError(409, 'Um ou mais dos itens selecionados já pertencem a outro pacote.');
    const newBundle = bundleRepo.create({ ...data, authorId, contents });
    return await bundleRepo.save(newBundle);
};

export const updateBundle = async (bundleId: string, authorId: number, data: Partial<z.infer<typeof UpdateBundleSchema>>) => {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const contentRepo = AppDataSource.getRepository(HomebrewContent);
    const bundle = await bundleRepo.findOne({ where: { id: bundleId }, relations: ['contents'] });
    if (!bundle) throw createError(404, 'Pacote não encontrado.');
    if (bundle.authorId !== authorId) throw createError(403, 'Você não tem permissão para editar este pacote.');

    if (data.name) bundle.name = data.name;
    if (data.description) bundle.description = data.description;
    if (data.isPublic !== undefined) bundle.isPublic = data.isPublic;

    if (data.contentIds) {
        await contentRepo.update({ bundleId: bundle.id }, { bundle: null, bundleId: null });
        const newContents = await contentRepo.find({ where: { id: In(data.contentIds), authorId } });
        if (newContents.length !== data.contentIds.length) throw createError(400, 'Alguns itens de conteúdo não foram encontrados ou não pertencem a você.');
        const alreadyInAnotherBundle = await contentRepo.count({ where: { id: In(data.contentIds), bundleId: Not(IsNull()) } });
        if (alreadyInAnotherBundle > 0) throw createError(409, 'Um ou mais itens já pertencem a outro pacote.');
        bundle.contents = newContents;
    }
    return await bundleRepo.save(bundle);
}

export const deleteBundle = async (bundleId: string, authorId: number) => {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const contentRepo = AppDataSource.getRepository(HomebrewContent);
    const bundle = await bundleRepo.findOneBy({ id: bundleId, authorId });
    if (!bundle) throw createError(404, 'Pacote não encontrado ou você não tem permissão.');
    await contentRepo.update({ bundleId }, { bundle: null, bundleId: null });
    await bundleRepo.remove(bundle);
}
