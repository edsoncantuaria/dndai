// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { getResourceList as fetchResourceList, getDetails as fetchDetails } from './dndApiService.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { User } from '../entities/User.js';
import { In, FindOptionsWhere, Like } from 'typeorm';

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 horas

const normalize = (s?: string) => (s ?? '').toLowerCase().trim();

/**
 * Retorna uma lista de recursos (ex: 'races'), unindo dados oficiais, públicos e do usuário.
 */
export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = normalize(resource);
    const publicCacheKey = `unified-public-list:${normalizedResource}`;
    
    // 1. Busca a lista base pública (oficial + homebrew público) do cache ou a constrói.
    let publicList: any[] = [];
    if (redisClient && redisClient.isOpen) {
        const cachedPublic = await redisClient.get(publicCacheKey);
        if (cachedPublic) {
            publicList = JSON.parse(cachedPublic);
        }
    }
    
    if (publicList.length === 0) {
        const officialData = await fetchResourceList(normalizedResource);
        const publicHomebrew = await AppDataSource.getRepository(HomebrewContent).find({
            where: { isPublic: true, type: normalizedResource as any },
            select: ["id", "name", "content"]
        });

        const publicMap = new Map<string, any>();
        (officialData?.results || []).forEach(item => publicMap.set(item.index, { ...item, source: 'official' }));
        publicHomebrew.forEach(hb => {
            const index = hb.content.index || hb.id;
            publicMap.set(index, { index: hb.id, name: `(H) ${hb.name}`, url: `/api/data/${normalizedResource}/${hb.id}`, source: 'homebrew' });
        });
        
        publicList = Array.from(publicMap.values());
        if (redisClient && redisClient.isOpen && publicList.length > 0) {
            await redisClient.set(publicCacheKey, JSON.stringify(publicList), { EX: CACHE_TTL_SECONDS });
        }
    }
    
    // 2. Se o usuário não estiver logado, retorna a lista pública.
    if (!userId) {
        return publicList.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 3. Busca o conteúdo específico do usuário (privado e instalado)
    const userRepo = AppDataSource.getRepository(User);
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const user = await userRepo.findOneBy({ id: userId });
    
    const installedIds = user?.installedHomebrewIds || [];
    const userSpecificWhere: FindOptionsWhere<HomebrewContent>[] = [
        // Itens privados criados pelo usuário
        { authorId: userId, type: normalizedResource as any, isPublic: false },
    ];
    if (installedIds.length > 0) {
        // Itens públicos instalados por ele (que não sejam dele)
        userSpecificWhere.push({ id: In(installedIds), type: normalizedResource as any, isPublic: true });
    }

    const userSpecificContent = await homebrewRepo.find({
        where: userSpecificWhere,
        select: ["id", "name", "content", "authorId", "isPublic"]
    });

    // 4. Mescla a lista pública com o conteúdo do usuário.
    const finalMap = new Map(publicList.map((item: any) => [item.index, item]));
    
    userSpecificContent.forEach(hb => {
        const index = hb.content.index || hb.id;
        const prefix = hb.authorId === userId && !hb.isPublic ? '(Meu)' : '(Instalado)';
        finalMap.set(index, { index: hb.id, name: `${prefix} ${hb.name}`, url: `/api/data/${normalizedResource}/${hb.id}`, source: 'mine' });
    });

    return Array.from(finalMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Retorna os detalhes de um recurso específico, aplicando a lógica de prioridade.
 */
export async function getUnifiedDetails(resource: string, index: string, userId?: number): Promise<any> {
    const normalizedResource = normalize(resource);
    const normalizedIndex = normalize(index);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedIndex);

    // Prioridade 1: Homebrew específico (se for UUID ou se houver um override instalado)
    let homebrewOverride: HomebrewContent | null = null;
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);

    if (isUuid) {
        homebrewOverride = await homebrewRepo.findOneBy({ id: normalizedIndex });
    } else if (userId) {
        const user = await AppDataSource.getRepository(User).findOneBy({ id: userId });
        const installedIds = user?.installedHomebrewIds || [];
        if (installedIds.length > 0) {
             homebrewOverride = await homebrewRepo.findOne({
                where: { id: In(installedIds), content: Like(`%"official_index":"${normalizedIndex}"%`) } as any
            });
        }
        // Se não encontrar nos instalados, busca nos privados do usuário
        if (!homebrewOverride) {
            homebrewOverride = await homebrewRepo.findOne({
                where: { authorId: userId, content: Like(`%"official_index":"${normalizedIndex}"%`) } as any,
            });
        }
    }

    // Se encontramos um homebrew via ID ou override, retornamos ele.
    if (homebrewOverride) {
        if (!homebrewOverride.isPublic && homebrewOverride.authorId !== userId) {
            throw createError(403, 'Acesso negado a este conteúdo privado.');
        }
        return homebrewOverride.content;
    }
    
    // Se for UUID mas não encontrado, erro.
    if(isUuid && !homebrewOverride) {
         throw createError(404, 'Conteúdo Homebrew não encontrado.');
    }

    // Prioridade 2: Conteúdo Oficial (com cache)
    const officialData = await fetchDetails(normalizedResource, normalizedIndex);
    if (!officialData) {
        throw createError(404, `Recurso '${normalizedIndex}' em '${normalizedResource}' não encontrado.`);
    }
    
    // Tenta encontrar uma tradução oficial do admin (usuário 1)
    const adminTranslation = await homebrewRepo.findOne({
        where: { type: 'translation', name: Like(officialData.name) }
    });
    
    if (adminTranslation) {
        return { ...officialData, ...adminTranslation.content, name: adminTranslation.content.name || officialData.name };
    }

    return officialData;
}


export async function getSpecialDetails(resource: string, index: string, special: string, userId?: number): Promise<any> {
    const normalizedResource = normalize(resource);
    const normalizedIndex = normalize(index);
    const normalizedSpecial = normalize(special);
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedIndex);

    if (isUuid) {
        const hbContent = await AppDataSource.getRepository(HomebrewContent).findOneBy({ id: normalizedIndex });
        if (!hbContent) {
            throw createError(404, `Conteúdo homebrew com ID '${normalizedIndex}' não encontrado.`);
        }
        if (normalizedSpecial === 'levels') {
            const features = (hbContent.content as any).features || [];
             return Array.from({ length: 20 }, (_, i) => i + 1).map(level => ({
                level: level,
                features: features.filter((f: any) => f.level === level)
            }));
        } else if (normalizedSpecial === 'spells') {
            return (hbContent.content as any).spells || { count: 0, results: [] };
        }
    }

    // Fallback para API oficial se não for UUID
    const data = await fetchDetails(normalizedResource, `${normalizedIndex}/${normalizedSpecial}`);
    if (!data) throw createError(404, `Recurso especial '${normalizedSpecial}' para '${normalizedIndex}' não encontrado.`);
    return data;
}
