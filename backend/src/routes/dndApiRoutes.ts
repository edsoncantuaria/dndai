// backend/src/routes/dndApiRoutes.ts
import { Router } from 'express';
import * as DndApiService from '../services/dndApiService.js';
import * as HomebrewService from '../services/homebrewService.js';
import * as UserService from '../services/userService.js';
import createError from 'http-errors';
import { HomebrewContentType } from '../entities/HomebrewContent.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { User } from '../entities/User.js';

const router = Router();

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Todas as rotas agora usam autenticação para obter o contexto do usuário
router.use(authMiddleware);

// Rota genérica para buscar listas de recursos (raças, classes, etc.)
router.get('/:resource', async (req, res, next) => {
    const resource = req.params.resource as HomebrewContentType;
    const userId = (req as any).user?.userId;

    if (!userId) {
        return next(createError(401, 'Usuário não autenticado.'));
    }

    try {
        const user = await UserService.getUserProfile(userId);
        const installedIds = user.installedHomebrewIds || [];

        const apiPromise = DndApiService.getResourceList(resource);
        
        // Busca todo o conteúdo público E o conteúdo do próprio usuário, pois ambos são "instaláveis"
        const publicHomebrewPromise = HomebrewService.getPublicHomebrewContent(resource, 'user');
        const userHomebrewPromise = HomebrewService.getHomebrewContentByAuthor(userId, resource);
        const aiContentPromise = HomebrewService.getPublicHomebrewContent(resource, 'ai');
        const adminTranslationsPromise = HomebrewService.getAdminTranslations(resource);

        // **NOVO**: Busca os detalhes do conteúdo que o usuário de fato instalou
        const installedHomebrewPromise = installedIds.length > 0 
            ? HomebrewService.getMultipleHomebrewContentByIds(installedIds, resource) 
            : Promise.resolve([]);
        
        const [apiData, publicHomebrew, userHomebrew, aiContent, adminTranslations, installedHomebrew] = await Promise.all([
            apiPromise, 
            publicHomebrewPromise, 
            userHomebrewPromise, 
            aiContentPromise,
            adminTranslationsPromise,
            installedHomebrewPromise, // Aguarda a busca do conteúdo instalado
        ]);
        
        const finalResultsMap = new Map<string, { index: string, name: string, url: string }>();

        // 1. Adiciona conteúdo oficial
        (apiData?.results || []).forEach(item => {
            finalResultsMap.set(item.index, item);
        });

        // 2. Sobrescreve com as traduções do admin
        adminTranslations.forEach(translation => {
            const officialIndex = translation.content.official_index;
            if (officialIndex && finalResultsMap.has(officialIndex)) {
                finalResultsMap.set(officialIndex, {
                    ...finalResultsMap.get(officialIndex)!,
                    name: translation.name, // Usa o nome da tradução
                });
            }
        });
        
        // 3. Adiciona TODO o conteúdo da IA, tratando-o como parte da base
        aiContent.forEach(aiItem => {
             const displayName = `(IA) ${aiItem.name}`;
             finalResultsMap.set(aiItem.content.index || aiItem.id, {
                index: aiItem.content.index || aiItem.id,
                name: displayName,
                url: `/api/dnds/${resource}/${aiItem.id}`
             });
        });

        // 4. Adiciona homebrew instalado (que não seja da IA), que pode sobrescrever o oficial ou ser novo
        installedHomebrew.forEach(hb => {
            const officialIndex = hb.content.index;
            const displayName = `(H) ${hb.name}`;

            if (officialIndex && finalResultsMap.has(officialIndex)) {
                 finalResultsMap.set(officialIndex, {
                    index: officialIndex,
                    name: displayName,
                    url: `/api/dnds/${resource}/${officialIndex}`
                });
            } else {
                 finalResultsMap.set(hb.id, {
                    index: hb.id,
                    name: displayName,
                    url: `/api/dnds/${resource}/${hb.id}`
                });
            }
        });
        
        const finalResults = Array.from(finalResultsMap.values()).sort((a,b) => a.name.localeCompare(b.name));
        
        return res.json({
            count: finalResults.length,
            results: finalResults,
        });

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

        if (adminTranslation) {
             const mergedData = { ...(officialData || {}), ...adminTranslation.content, name: adminTranslation.name };
             return res.json(mergedData);
        }

        const homebrewOverride = await HomebrewService.findHomebrewByOfficialIndex(index, resource as HomebrewContentType, userId);
        if (homebrewOverride) {
            const mergedData = { ...(officialData || {}), ...homebrewOverride.content, name: homebrewOverride.name, desc: homebrewOverride.content.desc || officialData?.desc };
            return res.json(mergedData);
        }
        
        if (!officialData) return next(createError(404, `Detalhes para '${index}' em '${resource}' não encontrados.`));
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
