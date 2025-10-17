// backend/src/services/homebrewService.ts
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { HomebrewBundle } from '../entities/HomebrewBundle.js';
import createError from 'http-errors';
import type { z } from 'zod';
import type { CreateHomebrewSchema } from '../schemas/validationSchemas.js';
import { FindManyOptions, In, Like, IsNull, Not } from 'typeorm';

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
export const getPublicHomebrewContent = async (type?: HomebrewContentType, createdBy?: 'user' | 'ai') => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const whereCondition: FindManyOptions<HomebrewContent>['where'] = { isPublic: true };

    if (type) {
        whereCondition.type = type;
    }
    if (createdBy) {
        whereCondition.createdBy = createdBy;
    }

    return homebrewRepo.find({
        where: whereCondition,
        select: ["id", "name", "type", "authorId", "createdAt", "createdBy", "content"], // Adicionado content para debug e uso
    });
};

/**
 * Lista todo o conteúdo homebrew criado por um usuário específico.
 * @param authorId O ID do usuário.
 * @param type Opcional. Filtra o conteúdo por tipo.
 * @returns Uma lista de conteúdos homebrew do usuário.
 */
export const getHomebrewContentByAuthor = async (authorId: number, type?: HomebrewContentType) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const whereCondition: FindManyOptions<HomebrewContent>['where'] = { authorId };

    if (type) {
        whereCondition.type = type;
    }

    return homebrewRepo.find({
        where: whereCondition,
        relations: ['author'],
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
    const content = await repo.findOneBy({ id: contentId });

    if (!content) {
        return [];
    }

    const allDependencies = [content];

    if (content.dependencies && content.dependencies.length > 0) {
        for (const depId of content.dependencies) {
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

/**
 * Lista todos os pacotes públicos e os criados pelo usuário.
 * @param userId O ID do usuário para buscar seus pacotes privados.
 */
export const getPublicAndUserBundles = async (userId?: number) => {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const query = bundleRepo.createQueryBuilder('bundle')
        .leftJoinAndSelect('bundle.author', 'author')
        .leftJoinAndSelect('bundle.contents', 'contents')
        .where('bundle.isPublic = true');
    
    if (userId) {
        query.orWhere('bundle.authorId = :userId', { userId });
    }
    
    return query.getMany();
};

/**
 * Obtém todo o conteúdo de um pacote específico.
 * @param bundleId O ID do pacote.
 */
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

/**
 * Cria um novo pacote de conteúdo.
 * @param authorId ID do criador.
 * @param name Nome do pacote.
 * @param description Descrição do pacote.
 * @param contentIds IDs dos conteúdos a serem incluídos.
 */
export const createBundle = async (authorId: number, name: string, description: string, contentIds: string[]) => {
    const bundleRepo = AppDataSource.getRepository(HomebrewBundle);
    const contentRepo = AppDataSource.getRepository(HomebrewContent);

    // Verifica se os conteúdos existem e pertencem ao autor
    const contents = await contentRepo.find({
        where: { id: In(contentIds), authorId: authorId }
    });

    if (contents.length !== contentIds.length) {
        throw createError(403, 'Um ou mais itens de conteúdo não foram encontrados ou você não tem permissão para usá-los.');
    }
    
    // Verifica se algum dos conteúdos já pertence a outro bundle
    const contentAlreadyInBundle = await contentRepo.count({
        where: { id: In(contentIds), bundle: { id: Not(IsNull()) } }
    });

    if (contentAlreadyInBundle > 0) {
        throw createError(409, 'Um ou mais dos itens selecionados já pertencem a outro pacote. Um item só pode estar em um pacote.');
    }

    const newBundle = new HomebrewBundle();
    newBundle.authorId = authorId;
    newBundle.name = name;
    newBundle.description = description;
    newBundle.contents = contents;
    newBundle.isPublic = false; // Pacotes começam como privados

    return await bundleRepo.save(newBundle);
};
