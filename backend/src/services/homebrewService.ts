// backend/src/services/homebrewService.ts
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import createError from 'http-errors';
import type { z } from 'zod';
import type { CreateHomebrewSchema } from '../schemas/validationSchemas.js';
import { FindManyOptions, In } from 'typeorm';

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
    
    try {
        const savedContent = await homebrewRepo.save(newContent);
        return savedContent;
    } catch (error: any) {
        console.error("Erro ao salvar conteúdo homebrew:", error);
        throw createError(500, 'Falha ao salvar o conteúdo no banco de dados.');
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
