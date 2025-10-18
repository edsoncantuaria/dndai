// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { getResourceList, getDetails } from './dndApiService.js';
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import createError from 'http-errors';
import { In, FindOptionsWhere } from 'typeorm';

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 horas

/**
 * Retorna uma lista de recursos (ex: 'races'), unindo dados oficiais, públicos e do usuário.
 */
export async function getUnifiedList(resource: string, userId: number): Promise<any[]> {
    const publicCacheKey = `unified-public-list:${resource}`;

    // 1. Busca a lista base pública (cache ou API)
    let publicList: any[] = [];
    if (redisClient && redisClient.isOpen) {
        const cachedPublic = await redisClient.get(publicCacheKey);
        if (cachedPublic) {
            console.log(`[Cache] HIT: Usando lista pública compartilhada para ${resource}.`);
            publicList = JSON.parse(cachedPublic);
        }
    }

    if (publicList.length === 0) {
        console.log(`[Cache] MISS: Construindo lista pública para ${resource}.`);
        const officialData = await getResourceList(resource);
        const publicHomebrew = await AppDataSource.getRepository(HomebrewContent).find({
            where: { isPublic: true, type: resource as any },
            select: ["id", "name", "content"]
        });

        const publicMap = new Map<string, any>();
        (officialData?.results || []).forEach(item => publicMap.set(item.index, { ...item, source: 'official' }));
        publicHomebrew.forEach(hb => {
            const index = hb.content.index || hb.id;
            publicMap.set(index, { index: hb.id, name: `(H) ${hb.name}`, url: `/api/data/${resource}/${hb.id}`, source: 'homebrew' });
        });

        publicList = Array.from(publicMap.values());
        if (redisClient && redisClient.isOpen && publicList.length > 0) {
            await redisClient.set(publicCacheKey, JSON.stringify(publicList), { EX: CACHE_TTL_SECONDS });
        }
    }

    // 2. Busca o conteúdo específico do usuário (instalado e privado)
    const userRepo = AppDataSource.getRepository(User);
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    
    const user = await userRepo.findOneBy({ id: userId });
    const installedIds = user?.installedHomebrewIds || [];

    const userSpecificWhere: FindOptionsWhere<HomebrewContent>[] = [
        { authorId: userId, type: resource as any, isPublic: false }, // Privado do usuário
    ];
    if (installedIds.length > 0) {
        userSpecificWhere.push({ id: In(installedIds), type: resource as any }); // Instalado pelo usuário
    }

    const userSpecificContent = await homebrewRepo.find({
        where: userSpecificWhere,
        select: ["id", "name", "content", "authorId", "isPublic"]
    });

    // 3. Mescla a lista pública com o conteúdo do usuário, dando prioridade ao do usuário.
    const finalMap = new Map(publicList.map((item: any) => [item.index, item]));
    
    userSpecificContent.forEach(hb => {
        const index = hb.content.index || hb.id;
        const prefix = hb.authorId === userId && !hb.isPublic ? '(Meu)' : '(Instalado)';
        finalMap.set(index, { index: hb.id, name: `${prefix} ${hb.name}`, url: `/api/data/${resource}/${hb.id}`, source: 'mine' });
    });

    return Array.from(finalMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Retorna os detalhes de um recurso específico, aplicando a lógica de prioridade.
 */
export async function getUnifiedDetails(resource: string, index: string, userId: number): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(index);

    // Se for um UUID, é um item homebrew. Busca diretamente.
    if (isUuid) {
        const hbContent = await AppDataSource.getRepository(HomebrewContent).findOneBy({ id: index });
        if (!hbContent) throw createError(404, 'Conteúdo não encontrado.');
        
        // Verifica se o usuário tem permissão para ver (se for privado e não for dele)
        if (!hbContent.isPublic && hbContent.authorId !== userId) {
            const user = await AppDataSource.getRepository(User).findOneBy({id: userId});
            if (!user?.installedHomebrewIds?.includes(hbContent.id)) {
                 throw createError(403, 'Acesso negado a este conteúdo privado.');
            }
        }
        return hbContent.content;
    }

    // Se não for UUID, busca o conteúdo oficial como base.
    const officialData = await getDetails(resource, index);
    
    // Procura por um override do usuário (instalado ou privado) que corresponda ao índice oficial.
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    const installedIds = user?.installedHomebrewIds || [];

    if (installedIds.length > 0) {
        const installedOverride = await AppDataSource.getRepository(HomebrewContent).findOne({
            where: [
                { id: In(installedIds), content: { official_index: index } as any },
                { authorId: userId, content: { official_index: index } as any }
            ]
        });

        if (installedOverride) {
            console.log(`[UnifiedDetails] Sobrescrevendo '${index}' com conteúdo instalado/privado do usuário.`);
            // Mescla os dados oficiais com as alterações do homebrew.
            const mergedContent = { ...officialData, ...installedOverride.content };
            // Garante que o nome seja o traduzido/customizado.
            mergedContent.name = installedOverride.content.name || officialData.name;
            return mergedContent;
        }
    }
    
    if (!officialData) {
        throw createError(404, `Recurso '${index}' em '${resource}' não encontrado.`);
    }

    return officialData;
}


export async function getSpecialDetails(resource: string, index: string, special: string, userId: number): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(index);

    if (isUuid) {
        const hbContent = await AppDataSource.getRepository(HomebrewContent).findOneBy({ id: index });
        if (!hbContent) {
            throw createError(404, `Conteúdo homebrew com ID '${index}' não encontrado.`);
        }
        if (special === 'levels') {
            const features = (hbContent.content as any).features || [];
             return Array.from({ length: 20 }, (_, i) => i + 1).map(level => ({
                level: level,
                features: features.filter((f: any) => f.level === level)
            }));
        } else if (special === 'spells') {
            return (hbContent.content as any).spells || { count: 0, results: [] };
        }
    }

    // Fallback para API oficial se não for UUID
    const data = await getDetails(resource, `${index}/${special}`);
    if (!data) throw createError(404, `Recurso especial '${special}' para '${index}' não encontrado.`);
    return data;
}
