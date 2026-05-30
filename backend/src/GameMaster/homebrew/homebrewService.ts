import { PenaiDataSource } from '../database/data-source.js';
import {
    PenaiHomebrewContent,
    type PenaiHomebrewContentType,
    type PenaiHomebrewSourceKind,
} from '../database/entities/HomebrewContent.js';
import { PenaiHomebrewBundle } from '../database/entities/HomebrewBundle.js';
import createError from 'http-errors';
import type { z } from 'zod';
import type {
    CreateHomebrewSchema,
    CreateFromSrdSchema,
    CreateBundleSchema,
    UpdateBundleSchema,
    ImportBundleSchema,
} from '../../schemas/validationSchemas.js';
import { FindManyOptions, In, Like, IsNull, Not } from 'typeorm';
import {
    assertOfficialResourceExists,
    buildContentFromSrd,
    inferSourceKind,
    resolveSrdResource,
    validateHomebrewPayload,
} from '../../services/srdHomebrewValidator.js';

type HomebrewContentType = PenaiHomebrewContentType;
type HomebrewContent = PenaiHomebrewContent;
type HomebrewBundle = PenaiHomebrewBundle;
type HomebrewSourceKind = PenaiHomebrewSourceKind;
const AppDataSource = PenaiDataSource;

interface PaginationOptions {
    page: number;
    limit: number;
}

export const createHomebrewContent = async (authorId: number, data: z.infer<typeof CreateHomebrewSchema>) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);

    if (data.type === 'translation') {
        const existing = await homebrewRepo.findOne({ where: { type: 'translation', name: data.name, authorId } });
        if (existing) {
            existing.content = data.content;
            return await homebrewRepo.save(existing);
        }
    }

    const sourceKind = (data.sourceKind ?? inferSourceKind(data.content)) as HomebrewSourceKind;
    const sourceResource = resolveSrdResource(data.type, data.sourceResource);
    const sourceIndex = data.sourceIndex ?? (data.content?.official_index as string | undefined) ?? null;

    validateHomebrewPayload(data.type, data.content, {
        sourceKind,
        sourceResource,
        sourceIndex,
        locale: data.locale ?? 'pt-BR',
    });

  if (sourceKind !== 'original' && sourceResource && sourceIndex) {
        await assertOfficialResourceExists(sourceResource, sourceIndex);
    }

    const newContent = new HomebrewContent();
    newContent.authorId = authorId;
    newContent.type = data.type;
    newContent.name = data.name;

    const contentPayload = { ...data.content };
    if (!contentPayload.index && data.type !== 'translation') {
        contentPayload.index = data.name.toLowerCase().replace(/\s+/g, '-') || `custom-${data.type}-${Date.now()}`;
    }
    if (sourceIndex && !contentPayload.official_index) {
        contentPayload.official_index = sourceIndex;
    }

    newContent.content = contentPayload;
    newContent.isPublic = data.isPublic || false;
    newContent.createdBy = data.createdBy || 'user';
    newContent.dependencies = data.dependencies || [];
    newContent.sourceKind = sourceKind;
    newContent.sourceResource = sourceResource;
    newContent.sourceIndex = sourceIndex ? sourceIndex.toLowerCase().trim() : null;
    newContent.locale = data.locale ?? 'pt-BR';
    
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

export const createHomebrewFromSrd = async (authorId: number, data: z.infer<typeof CreateFromSrdSchema>) => {
    const official = await assertOfficialResourceExists(data.sourceResource, data.sourceIndex);
    const content = buildContentFromSrd(
        official,
        data.sourceKind,
        data.overrides ?? {},
        data.sourceResource,
    );

    return createHomebrewContent(authorId, {
        type: data.type,
        name: data.name,
        content,
        isPublic: data.isPublic,
        sourceKind: data.sourceKind,
        sourceResource: data.sourceResource,
        sourceIndex: data.sourceIndex,
        locale: data.locale,
        dependencies: data.dependencies,
    });
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
    if (data.sourceKind) contentToUpdate.sourceKind = data.sourceKind;
    if (data.sourceResource !== undefined) contentToUpdate.sourceResource = data.sourceResource;
    if (data.sourceIndex !== undefined) contentToUpdate.sourceIndex = data.sourceIndex ? data.sourceIndex.toLowerCase().trim() : null;
    if (data.locale) contentToUpdate.locale = data.locale;

    validateHomebrewPayload(contentToUpdate.type, data.content, {
        sourceKind: contentToUpdate.sourceKind,
        sourceResource: contentToUpdate.sourceResource,
        sourceIndex: contentToUpdate.sourceIndex,
        locale: contentToUpdate.locale,
    });

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
        relations: ['bundle'],
        select: {
            id: true, name: true, type: true, authorId: true, createdAt: true, createdBy: true, isPublic: true, content: true, bundleId: true,
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
        relations: ['bundle'],
        select: {
            id: true, name: true, type: true, authorId: true, createdAt: true, createdBy: true, isPublic: true, content: true, bundleId: true,
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
             .andWhere("hb.content->>'official_index' = :index", { index: officialIndex });
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
        .leftJoinAndSelect('bundle.contents', 'contents')
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
};

function contentExportKey(content: HomebrewContent): string {
    const payload = typeof content.content === 'string' ? JSON.parse(content.content) : content.content;
    const fromIndex = payload?.index;
    if (typeof fromIndex === 'string' && fromIndex.trim()) {
        return fromIndex.toLowerCase().trim();
    }
    return content.name.toLowerCase().replace(/\s+/g, '-').slice(0, 80);
}

export const exportBundle = async (bundleId: string, userId?: number) => {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const bundle = await bundleRepo.findOne({
        where: { id: bundleId },
        relations: ['contents'],
    });
    if (!bundle) throw createError(404, 'Pacote não encontrado.');
    if (!bundle.isPublic && bundle.authorId !== userId) {
        throw createError(403, 'Você não tem permissão para exportar este pacote.');
    }

    const keyById = new Map(bundle.contents.map(item => [item.id, contentExportKey(item)]));

    return {
        formatVersion: 1 as const,
        exportedAt: new Date().toISOString(),
        bundle: {
            name: bundle.name,
            description: bundle.description,
            isPublic: bundle.isPublic,
        },
        contents: bundle.contents.map(item => {
            const payload = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
            return {
                exportKey: keyById.get(item.id)!,
                type: item.type,
                name: item.name,
                content: payload,
                sourceKind: item.sourceKind ?? 'original',
                sourceResource: item.sourceResource ?? null,
                sourceIndex: item.sourceIndex ?? null,
                locale: item.locale ?? 'pt-BR',
                dependencyKeys: (item.dependencies || [])
                    .map(depId => keyById.get(depId))
                    .filter((key): key is string => Boolean(key)),
            };
        }),
    };
};

export const importBundle = async (
    authorId: number,
    data: z.infer<typeof ImportBundleSchema>,
) => {
    const { manifest, makePublic } = data;
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const created: HomebrewContent[] = [];
    const idByKey = new Map<string, string>();

    for (const item of manifest.contents) {
        const saved = await createHomebrewContent(authorId, {
            type: item.type as HomebrewContentType,
            name: item.name,
            content: item.content,
            isPublic: false,
            sourceKind: item.sourceKind,
            sourceResource: item.sourceResource,
            sourceIndex: item.sourceIndex,
            locale: item.locale ?? 'pt-BR',
            dependencies: [],
        });
        created.push(saved);
        idByKey.set(item.exportKey, saved.id);
    }

    for (let i = 0; i < manifest.contents.length; i++) {
        const item = manifest.contents[i];
        const record = created[i];
        if (!item.dependencyKeys?.length) continue;
        const deps = item.dependencyKeys
            .map(key => idByKey.get(key))
            .filter((id): id is string => Boolean(id));
        if (deps.length) {
            record.dependencies = deps;
            await homebrewRepo.save(record);
        }
    }

    const bundle = await createBundle(authorId, {
        name: manifest.bundle.name,
        description: manifest.bundle.description,
        isPublic: makePublic ?? manifest.bundle.isPublic ?? false,
        contentIds: created.map(c => c.id),
    });

    return { bundle, contents: created };
};
