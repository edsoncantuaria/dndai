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

    const userCacheKey = `unified-list:${resource}:${userId}`;

    try {
        // 1. Tentar buscar a lista unificada específica do usuário do cache
        if (redisClient && redisClient.isOpen) {
            const cachedData = await redisClient.get(userCacheKey);
            if (cachedData) {
                console.log(`[Cache] HIT: Retornando lista unificada para ${resource} do usuário ${userId}.`);
                return res.json(JSON.parse(cachedData));
            }
        }

        console.log(`[Cache] MISS: Construindo lista unificada para ${resource} do usuário ${userId}.`);

        // 2. Se não estiver no cache do usuário, construir a lista
        const user = await UserService.getUserProfile(userId);
        const installedIds = user.installedHomebrewIds || [];

        // Buscar dados de todas as fontes em paralelo
        const [apiData, installedHomebrew, aiContent, adminTranslations] = await Promise.all([
            DndApiService.getResourceList(resource), // Esta função já usa um cache compartilhado
            installedIds.length > 0 ? HomebrewService.getMultipleHomebrewContentByIds(installedIds, resource) : Promise.resolve([]),
            HomebrewService.getPublicHomebrewContent(resource, 'ai'),
            HomebrewService.getAdminTranslations(resource)
        ]);

        const finalResultsMap = new Map<string, { index: string, name: string, url: string, source?: string }>();

        // Adiciona conteúdo oficial como base
        (apiData?.results || []).forEach(item => {
            finalResultsMap.set(item.index, { ...item, source: 'official' });
        });

        // Sobrescreve com traduções do admin (se houver correspondência de 'official_index')
        adminTranslations.forEach(translation => {
            const officialIndex = translation.content.official_index;
            if (officialIndex && finalResultsMap.has(officialIndex)) {
                const officialItem = finalResultsMap.get(officialIndex)!;
                finalResultsMap.set(officialIndex, {
                    ...officialItem,
                    name: translation.name, // A tradução principal é o nome do conteúdo
                });
            }
        });
        
        // Adiciona/sobrescreve com conteúdo instalado pelo usuário (maior prioridade)
        installedHomebrew.forEach(hb => {
            // Se for uma tradução, ele sobrescreve o nome do item oficial correspondente
            if (hb.type === 'translation') {
                // Para traduções, o `name` é a categoria, não tratamos aqui.
                return;
            }

            const officialIndex = hb.content.official_index;
            const displayName = `(H) ${hb.name}`;
            const url = `/api/dnds/${resource}/${hb.id}`;

            // Se este homebrew sobrescreve um item oficial
            if (officialIndex && finalResultsMap.has(officialIndex)) {
                const existingItem = finalResultsMap.get(officialIndex)!;
                finalResultsMap.set(officialIndex, { ...existingItem, name: displayName, url, source: 'homebrew' });
            } else { // Senão, é um item completamente novo
                finalResultsMap.set(hb.id, { index: hb.id, name: displayName, url, source: 'homebrew' });
            }
        });

        // Adiciona conteúdo gerado por IA se não houver um item com o mesmo índice
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

        // 3. Salvar a lista unificada no cache específico do usuário
        if (redisClient && redisClient.isOpen) {
            await redisClient.set(userCacheKey, JSON.stringify(responsePayload), { EX: 600 }); // Cache por 10 minutos
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
        // Se o índice for um UUID, é definitivamente homebrew
        if (isUuid(index)) {
             const hbContent = await HomebrewService.getHomebrewContentById(index, userId);
             if (!hbContent) return next(createError(404, `Conteúdo homebrew com ID '${index}' não encontrado.`));
             return res.json(hbContent.content);
        }

        // Busca o dado oficial primeiro, usando o cache compartilhado se possível
        const officialData = await DndApiService.getDetails(resource, index);
        
        // Verifica se há uma tradução do admin para este item
        const adminTranslation = await HomebrewService.findAdminTranslation(index, resource as HomebrewContentType);

        // Verifica se o usuário tem um homebrew instalado que sobrescreve este item oficial
        const userOverride = await HomebrewService.findHomebrewByOfficialIndex(index, resource as HomebrewContentType, userId);

        let finalData = officialData;
        let finalName = officialData?.name;

        // Aplica tradução se existir
        if (adminTranslation) {
            finalData = { ...(finalData || {}), ...adminTranslation.content };
            finalName = adminTranslation.name;
        }

        // Aplica a sobrescrita do usuário, que tem a maior prioridade
        if (userOverride) {
            finalData = { ...(finalData || {}), ...userOverride.content };
            finalName = `(H) ${userOverride.name}`; // Adiciona o prefixo (H)
        }

        if (!finalData) {
            return next(createError(404, `Detalhes para '${index}' em '${resource}' não encontrados.`));
        }
        
        finalData.name = finalName; // Garante que o nome final seja aplicado

        return res.json(finalData);

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

    