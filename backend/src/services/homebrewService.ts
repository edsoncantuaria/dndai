// backend/src/services/homebrewService.ts
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { HomebrewBundle } from '../entities/HomebrewBundle.js';
import createError from 'http-errors';
import type { z } from 'zod';
import type { CreateHomebrewSchema, CreateBundleSchema } from '../schemas/validationSchemas.js';
import { FindManyOptions, In, Like, IsNull, Not } from 'typeorm';

interface PaginationOptions {
    page: number;
    limit: number;
}

/**
 * Cria um novo conteúdo homebrew.
 * @param authorId O ID do usuário que está criando o conteúdo.
 * @param data Os dados do conteúdo homebrew validados.
 * @returns O conteúdo homebrew salvo.
 */
export const createHomebrewContent = async (authorId: number, data: z.infer<typeof CreateHomebrewSchema>) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);

    const newContent = new HomebrewContent();
    newContent.authorId = authorId;
    newContent.type = data.type;
    newContent.name = data.name;
    newContent.content = data.content;
    newContent.isPublic = data.isPublic || false;
    newContent.createdBy = data.createdBy || 'user';
    newContent.dependencies = data.dependencies || [];
    
    try {
        const savedContent = await homebrewRepo.save(newContent);
        return savedContent;
    } catch (error: any) {
        console.error("Erro ao salvar conteúdo homebrew:", error);
        throw createError(500, 'Falha ao salvar o conteúdo no banco de dados.');
    }
};

/**
 * Atualiza um conteúdo homebrew existente.
 * @param contentId O ID do conteúdo a ser atualizado.
 * @param authorId O ID do usuário que está tentando atualizar (para verificação de permissão).
 * @param data Os novos dados para o conteúdo.
 * @returns O conteúdo atualizado.
 */
export const updateHomebrewContent = async (contentId: string, authorId: number, data: z.infer<typeof CreateHomebrewSchema>) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const contentToUpdate = await homebrewRepo.findOneBy({ id: contentId });

    if (!contentToUpdate) {
        throw createError(404, 'Conteúdo Homebrew não encontrado.');
    }

    if (contentToUpdate.authorId !== authorId) {
        throw createError(403, 'Você não tem permissão para editar este conteúdo.');
    }
    
    if (contentToUpdate.bundleId) {
        throw createError(409, 'Este conteúdo não pode ser editado pois pertence a um pacote. Remova-o do pacote para editar.');
    }

    // Atualiza os campos
    contentToUpdate.name = data.name;
    contentToUpdate.content = data.content;
    contentToUpdate.isPublic = data.isPublic || false;
    contentToUpdate.dependencies = data.dependencies || [];

    try {
        const updatedContent = await homebrewRepo.save(contentToUpdate);
        return updatedContent;
    } catch (error: any) {
        console.error("Erro ao atualizar conteúdo homebrew:", error);
        throw createError(500, 'Falha ao atualizar o conteúdo no banco de dados.');
    }
};


/**
 * Lista todo o conteúdo homebrew público.
 * @param type Opcional. Filtra o conteúdo por tipo.
 * @param createdBy Opcional. Filtra por quem criou ('user' ou 'ai').
 * @returns Uma lista de conteúdos homebrew.
 */
export const getPublicHomebrewContent = async (type?: HomebrewContentType, createdBy?: 'user' | 'ai', pagination?: PaginationOptions) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const whereCondition: FindManyOptions<HomebrewContent>['where'] = { isPublic: true };
    const { page = 1, limit = 100 } = pagination || {};

    if (type) {
        whereCondition.type = type;
    }
    if (createdBy) {
        whereCondition.createdBy = createdBy;
    }

    return homebrewRepo.find({
        where: whereCondition,
        select: ["id", "name", "type", "authorId", "createdAt", "createdBy", "content"],
        take: limit,
        skip: (page - 1) * limit,
    });
};

/**
 * Lista todo o conteúdo homebrew criado por um usuário específico.
 * @param authorId O ID do usuário.
 * @param type Opcional. Filtra o conteúdo por tipo.
 * @returns Uma lista de conteúdos homebrew do usuário.
 */
export const getHomebrewContentByAuthor = async (authorId: number, type?: HomebrewContentType, pagination?: PaginationOptions) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const whereCondition: FindManyOptions<HomebrewContent>['where'] = { authorId };
    const { page = 1, limit = 100 } = pagination || {};


    if (type) {
        whereCondition.type = type;
    }

    return homebrewRepo.find({
        where: whereCondition,
        relations: ['author'],
        take: limit,
        skip: (page - 1) * limit,
    });
};

/**
 * Obtém os detalhes completos de um único conteúdo homebrew.
 * @param contentId O ID do conteúdo.
 * @param userId Opcional. O ID do usuário solicitante para verificação de permissão.
 * @returns O objeto de conteúdo homebrew completo.
 */
export const getHomebrewContentById = async (contentId: string, userId?: number) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const content = await homebrewRepo.findOneBy({ id: contentId });

    if (!content) {
        throw createError(404, 'Conteúdo Homebrew não encontrado.');
    }

    // Se o conteúdo não for público, apenas o autor pode vê-lo.
    if (!content.isPublic && content.authorId !== userId) {
        throw createError(403, 'Você não tem permissão para visualizar este conteúdo.');
    }

    return content;
};


/**
 * Obtém múltiplos conteúdos homebrew por uma lista de IDs.
 * @param contentIds Um array de IDs de conteúdo.
 * @param type Opcional. Filtra o conteúdo por tipo.
 * @returns Uma lista de objetos de conteúdo homebrew.
 */
export const getMultipleHomebrewContentByIds = async (contentIds: string[], type?: HomebrewContentType): Promise<HomebrewContent[]> => {
    if (contentIds.length === 0) return [];
    
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const whereCondition: FindManyOptions<HomebrewContent>['where'] = { 
        id: In(contentIds) 
    };
    
    if (type) {
        whereCondition.type = type;
    }
    
    return homebrewRepo.find({ where: whereCondition });
};


/**
 * Encontra um conteúdo homebrew que sobrescreve um item oficial, usando o `index` do item oficial.
 * @param officialIndex O `index` do conteúdo oficial (ex: 'longsword', 'fireball').
 * @param type O tipo do conteúdo.
 * @returns O primeiro conteúdo homebrew encontrado ou null.
 */
export const findHomebrewByOfficialIndex = async (officialIndex: string, type: HomebrewContentType): Promise<HomebrewContent | null> => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    
    // Esta é uma consulta que olha dentro do campo JSON `content`.
    // A sintaxe pode variar ligeiramente entre bancos de dados.
    // Para MySQL/PostgreSQL, JSON_EXTRACT ou ->> funciona.
    return homebrewRepo
        .createQueryBuilder("hb")
        .where("hb.type = :type", { type })
        .andWhere("JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.index')) = :index", { index: officialIndex })
        .andWhere("hb.isPublic = true") // Garante que apenas conteúdo público possa sobrescrever
        .getOne();
};


/**
 * Busca recursivamente todas as dependências de um item homebrew.
 * @param contentId O ID do conteúdo homebrew inicial.
 * @param visited Um set para evitar loops de dependência infinitos.
 * @returns Um array de objetos HomebrewContent, incluindo o item original e todas as suas dependências.
 */
export const getHomebrewDependencies = async (
    contentId: string,
    visited = new Set<string>()
): Promise<HomebrewContent[]> => {
    if (visited.has(contentId)) {
        return []; // Evita recursão infinita
    }
    visited.add(contentId);

    const repo = AppDataSource.getRepository(HomebrewContent);
    const content = await repo.findOne({ where: { id: contentId }, relations: ['bundle', 'bundle.contents'] });

    if (!content) {
        return [];
    }
    
    // Se o conteúdo pertence a um bundle, todas as outras partes do bundle são consideradas dependências.
    const bundleDependencies = content.bundle ? content.bundle.contents.filter(c => c.id !== content.id) : [];

    const allDependencies = [content, ...bundleDependencies];

    const allDependencyIds = new Set([
        ...(content.dependencies || []),
        ...bundleDependencies.flatMap(c => c.dependencies || [])
    ]);

    if (allDependencyIds.size > 0) {
        for (const depId of allDependencyIds) {
            const nestedDependencies = await getHomebrewDependencies(depId, visited);
            allDependencies.push(...nestedDependencies);
        }
    }

    // Retorna uma lista única de dependências
    return Array.from(new Map(allDependencies.map(item => [item.id, item])).values());
};

/**
 * Verifica se um nome (que será convertido para um índice) já existe para um tipo específico.
 * @param name O nome do conteúdo.
 * @param type O tipo do conteúdo.
 * @returns `true` se o nome já existe, `false` caso contrário.
 */
export const checkIfNameExists = async (name: string, type: HomebrewContentType): Promise<boolean> => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const index = name.toLowerCase().replace(/\s+/g, '-');
    
    const count = await homebrewRepo.count({
        where: [
            { type, name: Like(name) },
            { type, content: Like(`%"index":"${index}"%`) }
        ]
    });
    
    return count > 0;
};

// --- Bundle Functions ---

export const getBundles = async (userId?: number, scope?: 'public' | 'mine') => {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const query = bundleRepo.createQueryBuilder('bundle')
        .leftJoinAndSelect('bundle.author', 'author')
        .leftJoinAndSelect('bundle.contents', 'contents');

    if (scope === 'mine' && userId) {
        query.where('bundle.authorId = :userId', { userId });
    } else if (scope === 'public') {
        query.where('bundle.isPublic = true');
    } else if (userId) { // Se não houver scope, mas houver userId, mostra publicos e do usuario
        query.where('bundle.isPublic = true OR bundle.authorId = :userId', { userId });
    } else { // Se não houver userId nem scope, mostra apenas publicos
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

    if (!bundle) {
        throw createError(404, 'Pacote não encontrado.');
    }
    return bundle.contents;
};

export const createBundle = async (authorId: number, data: z.infer<typeof CreateBundleSchema>) => {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const contentRepo = AppDataSource.getRepository(HomebrewContent);

    // Verifica se os conteúdos existem e pertencem ao autor
    const contents = await contentRepo.find({
        where: { id: In(data.contentIds), authorId: authorId }
    });

    if (contents.length !== data.contentIds.length) {
        throw createError(403, 'Um ou mais itens de conteúdo não foram encontrados ou você não tem permissão para usá-los.');
    }
    
    // Verifica se algum dos conteúdos já pertence a outro bundle
    const contentAlreadyInBundle = await contentRepo.count({
        where: { id: In(data.contentIds), bundleId: Not(IsNull()) }
    });

    if (contentAlreadyInBundle > 0) {
        throw createError(409, 'Um ou mais dos itens selecionados já pertencem a outro pacote. Um item só pode estar em um pacote.');
    }

    const newBundle = new HomebrewBundle();
    newBundle.authorId = authorId;
    newBundle.name = data.name;
    newBundle.description = data.description;
    newBundle.contents = contents;
    newBundle.isPublic = data.isPublic || false;

    return await bundleRepo.save(newBundle);
};


export const updateBundle = async (bundleId: string, authorId: number, data: Partial<z.infer<typeof CreateBundleSchema>>) => {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const contentRepo = AppDataSource.getRepository(HomebrewContent);
    const bundle = await bundleRepo.findOne({ where: { id: bundleId }, relations: ['contents']});

    if (!bundle) throw createError(404, 'Pacote não encontrado.');
    if (bundle.authorId !== authorId) throw createError(403, 'Você não tem permissão para editar este pacote.');

    if (data.name) bundle.name = data.name;
    if (data.description) bundle.description = data.description;
    if (data.isPublic !== undefined) bundle.isPublic = data.isPublic;

    if (data.contentIds) {
        // Dissocia os itens antigos do bundle
        await contentRepo.update({ bundleId: bundle.id }, { bundleId: null });
        
        // Associa os novos itens ao bundle
        const newContents = await contentRepo.find({ where: { id: In(data.contentIds), authorId }});
        if (newContents.length !== data.contentIds.length) {
            throw createError(400, 'Alguns itens de conteúdo não foram encontrados ou não pertencem a você.');
        }
        
        const alreadyInAnotherBundle = await contentRepo.count({
             where: { id: In(data.contentIds), bundleId: Not(IsNull()) }
        });

        if (alreadyInAnotherBundle > 0) {
            throw createError(409, 'Um ou mais itens já pertencem a outro pacote.');
        }

        bundle.contents = newContents;
    }

    return await bundleRepo.save(bundle);
}

export const deleteBundle = async (bundleId: string, authorId: number) => {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const contentRepo = AppDataSource.getRepository(HomebrewContent);
    const bundle = await bundleRepo.findOneBy({ id: bundleId, authorId });
    if (!bundle) throw createError(404, 'Pacote não encontrado ou você não tem permissão.');
    
    // Dissocia os itens de conteúdo do bundle antes de excluí-lo
    await contentRepo.update({ bundleId: bundleId }, { bundleId: null });
    
    await bundleRepo.remove(bundle);
}
