// backend/src/services/homebrewService.ts
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import createError from 'http-errors';
import type { z } from 'zod';
import type { CreateHomebrewSchema } from '../schemas/validationSchemas.js';

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
    newContent.createdBy = data.createdBy || 'user'; // REVALIDATE START: Default to 'user'
    
    try {
        const savedContent = await homebrewRepo.save(newContent);
        return savedContent;
    } catch (error: any) {
        // Lidar com possíveis erros de banco de dados, como violações de constraint
        console.error("Erro ao salvar conteúdo homebrew:", error); // TEMP LOG
        throw createError(500, 'Falha ao salvar o conteúdo no banco de dados.');
    }
};

/**
 * Lista todo o conteúdo homebrew público.
 * @param type Opcional. Filtra o conteúdo por tipo.
 * @returns Uma lista de conteúdos homebrew.
 */
export const getPublicHomebrewContent = async (type?: HomebrewContentType) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const whereCondition: { isPublic: boolean; type?: HomebrewContentType } = { isPublic: true };

    if (type) {
        whereCondition.type = type;
    }

    return homebrewRepo.find({
        where: whereCondition,
        select: ["id", "name", "type", "authorId", "createdAt", "createdBy"], // Retorna apenas um resumo
    });
};

/**
 * Lista todo o conteúdo homebrew criado por um usuário específico.
 * @param authorId O ID do usuário.
 * @returns Uma lista de conteúdos homebrew do usuário.
 */
export const getHomebrewContentByAuthor = async (authorId: number) => {
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    return homebrewRepo.find({
        where: { authorId },
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
