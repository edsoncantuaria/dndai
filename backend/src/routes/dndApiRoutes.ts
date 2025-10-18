// backend/src/routes/dndApiRoutes.ts
import { Router } from 'express';
import * as DndApiService from '../services/dndApiService.js';
import * as HomebrewService from '../services/homebrewService.js';
import createError from 'http-errors';
import { HomebrewContentType } from '../entities/HomebrewContent.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { User } from '../entities/User.js';
import { AppDataSource } from '../database/data-source.js';

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
    
    try {
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOneBy({ id: userId });
        const installedIds = user?.installedHomebrewIds || [];

        // 1. Buscar todas as fontes de dados em paralelo.
        const [
            apiData,
            publicHomebrew,
            privateHomebrew,
            installedHomebrew
        ] = await Promise.all([
            DndApiService.getResourceList(resource),
            HomebrewService.getPublicHomebrewContent(resource),
            HomebrewService.getPrivateHomebrewContentForUser(userId, resource),
            installedIds.length > 0 ? HomebrewService.getMultipleHomebrewContentByIds(installedIds, resource) : Promise.resolve([])
        ]);

        // 2. Unificar os dados com a prioridade correta.
        const finalMap = new Map<string, { index: string, name: string, url: string, source: string }>();

        // Prioridade 1: Conteúdo oficial da API
        (apiData?.results || []).forEach(item => {
            if (item && item.index) {
                finalMap.set(item.index, { ...item, source: 'official' });
            }
        });

        // Prioridade 2: Conteúdo público da comunidade
        publicHomebrew.forEach(hb => {
            if (hb?.content?.index) {
                finalMap.set(hb.content.index, { index: hb.id, name: `(H) ${hb.name}`, url: `/api/dnds/${resource}/${hb.id}`, source: 'homebrew' });
            }
        });
        
        // Prioridade 3: Conteúdo instalado pelo usuário (sobrescreve os anteriores)
        installedHomebrew.forEach(hb => {
             // Se for uma tradução, modifica o item oficial existente em vez de adicionar um novo
            if (hb.type === 'translation' && hb.content.official_index) {
                 const officialItem = finalMap.get(hb.content.official_index);
                 if (officialItem) {
                     finalMap.set(hb.content.official_index, { ...officialItem, name: hb.name });
                 }
            } else if (hb.content && hb.content.index) {
                finalMap.set(hb.content.index, { index: hb.id, name: `(Instalado) ${hb.name}`, url: `/api/dnds/${resource}/${hb.id}`, source: 'installed' });
            }
        });
        
        // Prioridade 4: Conteúdo privado do usuário (também sobrescreve)
        privateHomebrew.forEach(hb => {
             if (hb.content && hb.content.index) {
                finalMap.set(hb.content.index, { index: hb.id, name: `(Meu) ${hb.name}`, url: `/api/dnds/${resource}/${hb.id}`, source: 'mine' });
            }
        });
        
        const finalResults = Array.from(finalMap.values()).sort((a,b) => a.name.localeCompare(b.name));

        return res.json({
            count: finalResults.length,
            results: finalResults
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
