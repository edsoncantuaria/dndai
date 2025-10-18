// backend/src/routes/dndApiRoutes.ts
import { Router } from 'express';
import * as DndApiService from '../services/dndApiService.js';
import * as HomebrewService from '../services/homebrewService.js';
import * as UserService from '../services/userService.js';
import createError from 'http-errors';
import { HomebrewContentType } from '../entities/HomebrewContent.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import redisClient from '../database/redis-client.js';

const router = Router();

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Todas as rotas agora usam autenticação para obter o contexto do usuário
router.use(authMiddleware);

// Rota genérica para buscar listas de recursos (raças, classes, etc.)
router.get('/:resource', async (req, res, next) => {
    const resource = req.params.resource as HomebrewContentType;
    const userId = (req as any).user?.userId;

    if (!userId) {
        return next(createError(401, 'Usuário não autenticado.'));
    }

    const cacheKey = `unified-list:${resource}:${userId}`;

    try {
        // 1. Tentar buscar a lista unificada do cache
        if (redisClient && redisClient.isOpen) {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log(`[Cache] HIT: Retornando lista unificada para ${resource} do usuário ${userId}.`);
                return res.json(JSON.parse(cachedData));
            }
        }

        console.log(`[Cache] MISS: Construindo lista unificada para ${resource} do usuário ${userId}.`);

        // 2. Se não estiver no cache, construir a lista
        const user = await UserService.getUserProfile(userId);
        const installedIds = user.installedHomebrewIds || [];

        const apiPromise = DndApiService.getResourceList(resource, false); // false para não usar o cache de item individual
        const installedHomebrewPromise = installedIds.length > 0
            ? HomebrewService.getMultipleHomebrewContentByIds(installedIds, resource)
            : Promise.resolve([]);
        const aiContentPromise = HomebrewService.getPublicHomebrewContent(resource, 'ai');
        const adminTranslationsPromise = HomebrewService.getAdminTranslations(resource);

        const [apiData, installedHomebrew, aiContent, adminTranslations] = await Promise.all([
            apiPromise,
            installedHomebrewPromise,
            aiContentPromise,
            adminTranslationsPromise,
        ]);

        const finalResultsMap = new Map<string, { index: string, name: string, url: string, source?: string }>();

        // Adiciona conteúdo oficial
        (apiData?.results || []).forEach(item => {
            finalResultsMap.set(item.index, { ...item, source: 'official' });
        });

        // Sobrescreve com traduções do admin
        adminTranslations.forEach(translation => {
            const officialIndex = translation.content.official_index;
            if (officialIndex && finalResultsMap.has(officialIndex)) {
                const officialItem = finalResultsMap.get(officialIndex)!;
                finalResultsMap.set(officialIndex, {
                    ...officialItem,
                    name: translation.name,
                });
            }
        });
        
        // Adiciona/sobrescreve com conteúdo instalado pelo usuário (exceto AI)
        installedHomebrew.filter(hb => hb.createdBy !== 'ai').forEach(hb => {
            const officialIndex = hb.content.index;
            const displayName = `(H) ${hb.name}`;
            const url = `/api/dnds/${resource}/${hb.id}`;
            // Se ele tem um `official_index` e esse item está na lista, ele sobrescreve o nome.
             if (officialIndex && finalResultsMap.has(officialIndex)) {
                const existingItem = finalResultsMap.get(officialIndex)!;
                finalResultsMap.set(officialIndex, { ...existingItem, name: displayName, url, source: 'homebrew' });
            } else {
            // Senão, é um item novo
                finalResultsMap.set(hb.id, { index: hb.id, name: displayName, url, source: 'homebrew' });
            }
        });

        // Adiciona conteúdo da IA se não estiver instalado (trata como base, mas não sobrescreve)
        aiContent.forEach(aiItem => {
             const key = aiItem.content.index || aiItem.id;
             if (!finalResultsMap.has(key)) {
                finalResultsMap.set(key, {
                    index: key,
                    name: `(IA) ${aiItem.name}`,
                    url: `/api/dnds/${resource}/${aiItem.id}`,
                    source: 'ai'
                });
             }
        });
        
        const finalResults = Array.from(finalResultsMap.values()).sort((a,b) => a.name.localeCompare(b.name));
        
        const responsePayload = {
            count: finalResults.length,
            results: finalResults,
        };

        // 3. Salvar a lista unificada no cache
        if (redisClient && redisClient.isOpen) {
            // Cache por 10 minutos para dar tempo de novas instalações aparecerem
            await redisClient.set(cacheKey, JSON.stringify(responsePayload), { EX: 600 });
        }

        return res.json(responsePayload);

    } catch (error) {
        next(error);
    }
});


// Rota para buscar detalhes de um recurso específico
router.get('/:resource/:index', async (req, res, next) => {
    const { resource, index } = req.params;
    const userId = (req as any).user?.userId;

    try {
        if (isUuid(index)) {
             const hbContent = await HomebrewService.getHomebrewContentById(index, userId);
             if (!hbContent) return next(createError(404, `Conteúdo homebrew com ID '${index}' não encontrado.`));
             return res.json(hbContent.content);
        }

        const adminTranslation = await HomebrewService.findAdminTranslation(index, resource as HomebrewContentType);
        const officialData = await DndApiService.getDetails(resource, index);

        if (!officialData && !adminTranslation) {
             const homebrewOverride = await HomebrewService.findHomebrewByOfficialIndex(index, resource as HomebrewContentType, userId);
             if(homebrewOverride) return res.json(homebrewOverride.content);

             return next(createError(404, `Detalhes para '${index}' em '${resource}' não encontrados.`));
        }
        
        // Prioridade: Conteúdo instalado pelo usuário > Tradução do Admin > Oficial
        const homebrewOverride = await HomebrewService.findHomebrewByOfficialIndex(index, resource as HomebrewContentType, userId);

        if (homebrewOverride) {
            const mergedData = { ...(officialData || {}), ...homebrewOverride.content, name: homebrewOverride.name, desc: homebrewOverride.content.desc || officialData?.desc };
            return res.json(mergedData);
        }

        if (adminTranslation) {
             const mergedData = { ...(officialData || {}), ...adminTranslation.content, name: adminTranslation.name };
             return res.json(mergedData);
        }
        
        return res.json(officialData);

    } catch (error) {
        next(error);
    }
});


// Rota específica para níveis de classe
router.get('/classes/:classIndex/levels', async (req, res, next) => {
    const { classIndex } = req.params;
    try {
        let data;
        if (isUuid(classIndex)) {
            const hbContent = await HomebrewService.getHomebrewContentById(classIndex, (req as any).user?.userId);
            if (!hbContent) {
                return next(createError(404, `Classe homebrew com ID '${classIndex}' não encontrada.`));
            }
            const features = (hbContent.content as any).features || [];
            
            data = Array.from({length: 20}, (_, i) => i + 1).map(level => ({
                level: level,
                features: features.filter((f: any) => f.level === level)
            }));

        } else {
            data = await DndApiService.getDetails('classes', `${classIndex}/levels`);
        }

        if (!data) return next(createError(404, `Níveis para a classe '${classIndex}' não encontrados.`));
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Rota para magias de classe
router.get('/classes/:classIndex/spells', async (req, res, next) => {
    const { classIndex } = req.params;
    try {
        if (isUuid(classIndex)) {
             const hbContent = await HomebrewService.getHomebrewContentById(classIndex, (req as any).user?.userId);
             if (!hbContent) {
                return next(createError(404, `Classe homebrew com ID '${classIndex}' não encontrada.`));
            }
            const spells = (hbContent.content as any).spells || { count: 0, results: [] };
             return res.json(spells);
        }

        const data = await DndApiService.getDetails('classes', `${classIndex}/spells`);
        if (!data) return next(createError(404, `Magias para a classe '${classIndex}' não encontradas.`));
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Rota para níveis de subclasse
router.get('/subclasses/:subclassIndex/levels', async (req, res, next) => {
    const { subclassIndex } = req.params;
    try {
        let data;
        if (isUuid(subclassIndex)) {
            const hbContent = await HomebrewService.getHomebrewContentById(subclassIndex, (req as any).user?.userId);
            if (!hbContent) {
                return next(createError(404, `Subclasse homebrew com ID '${subclassIndex}' não encontrada.`));
            }
            const features = (hbContent.content as any).features || [];
            
            data = Array.from({length: 20}, (_, i) => i + 1).map(level => ({
                level: level,
                features: features.filter((f: any) => f.level === level)
            }));
        } else {
            data = await DndApiService.getDetails('subclasses', `${subclassIndex}/levels`);
        }

        if (!data) return next(createError(404, `Níveis para a subclasse '${subclassIndex}' não encontrados.`));
        res.json(data);
    } catch (error) {
        next(error);
    }
});

export default router;
