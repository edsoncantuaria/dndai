// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { getResourceList, getDetails } from './dndApiService.js';
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import createError from 'http-errors';
import { In } from 'typeorm';

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 horas

/**
 * Retorna uma lista de recursos (ex: 'races'), unindo dados oficiais, públicos e do usuário.
 */
export async function getUnifiedList(resource: string, userId: number): Promise<any[]> {
    const publicCacheKey = `unified-public-list:${resource}`;

    let publicList;
    if (redisClient && redisClient.isOpen) {
        const cachedPublic = await redisClient.get(publicCacheKey);
        if (cachedPublic) {
            console.log(`[Cache] HIT: Usando lista pública compartilhada para ${resource}.`);
            publicList = JSON.parse(cachedPublic);
        }
    }

    if (!publicList) {
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
        if (redisClient && redisClient.isOpen) {
            await redisClient.set(publicCacheKey, JSON.stringify(publicList), { EX: CACHE_TTL_SECONDS });
        }
    }

    // Agora, mescla com o conteúdo privado do usuário
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    const installedIds = user?.installedHomebrewIds || [];

    const privateAndInstalledContent = await AppDataSource.getRepository(HomebrewContent).find({
        where: [
            { authorId: userId, isPublic: false, type: resource as any },
            { id: In(installedIds), type: resource as any }
        ],
        select: ["id", "name", "content"]
    });

    const finalMap = new Map(publicList.map((item: any) => [item.index, item]));
    privateAndInstalledContent.forEach(hb => {
        const index = hb.content.index || hb.id;
        const prefix = hb.authorId === userId ? '(Meu)' : '(Instalado)';
        finalMap.set(index, { index: hb.id, name: `${prefix} ${hb.name}`, url: `/api/data/${resource}/${hb.id}`, source: 'mine' });
    });

    return Array.from(finalMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Retorna os detalhes de um recurso específico, aplicando a lógica de prioridade.
 */
export async function getUnifiedDetails(resource: string, index: string, userId: number): Promise<any> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(index);

    if (isUuid) {
        const hbContent = await AppDataSource.getRepository(HomebrewContent).findOneBy({ id: index });
        if (!hbContent) throw createError(404, 'Conteúdo não encontrado.');
        if (!hbContent.isPublic && hbContent.authorId !== userId) throw createError(403, 'Acesso negado.');
        return hbContent.content;
    }

    let officialData = await getDetails(resource, index);
    
    // Procura por uma tradução do admin (usuário ID 1)
    const adminTranslation = await AppDataSource.getRepository(HomebrewContent).findOne({
        where: { authorId: 1, type: 'translation', content: { official_index: index, resource_type: resource } }
    });

    if (adminTranslation) {
        officialData = { ...officialData, ...adminTranslation.content, name: adminTranslation.name };
    }

    // Procura por um override do usuário (instalado ou privado)
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: userId });
    const installedIds = user?.installedHomebrewIds || [];

    const userOverride = await AppDataSource.getRepository(HomebrewContent).findOne({
        where: [
            { authorId: userId, content: { index } },
            { id: In(installedIds), content: { index } }
        ]
    });
    
    if (userOverride) {
        return { ...officialData, ...userOverride.content, name: `(H) ${userOverride.name}` };
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
