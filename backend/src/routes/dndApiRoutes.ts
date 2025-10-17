// backend/src/routes/dndApiRoutes.ts
import { Router } from 'express';
import * as DndApiService from '../services/dndApiService.js';
import * as HomebrewService from '../services/homebrewService.js';
import * as SessaoService from '../services/sessaoService.js';
import createError from 'http-errors';
import { HomebrewContentType } from '../entities/HomebrewContent.js';

const router = Router();

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Rota genérica para buscar listas de recursos (raças, classes, etc.)
router.get('/:resource', async (req, res, next) => {
    const resource = req.params.resource as HomebrewContentType;
    // Opcional: Se um sessionId for fornecido, podemos mesclar o conteúdo instalado.
    // Se não, mostramos o conteúdo público disponível para instalação.
    const sessionId = req.query.sessionId as string | undefined;

    console.debug(`[Backend Route] GET /dnds/${resource} (Sessão: ${sessionId || 'N/A'})`);

    try {
        const apiPromise = DndApiService.getResourceList(resource);

        // 1. Pegar o conteúdo público para exibir na "Oficina Homebrew" ou na criação de personagem
        const publicHomebrewPromise = HomebrewService.getPublicHomebrewContent(resource);
        
        const [apiData, publicHomebrew] = await Promise.all([apiPromise, publicHomebrewPromise]);
        
        const finalResultsMap = new Map<string, { index: string, name: string, url: string }>();

        // 2. Adiciona o conteúdo oficial primeiro
        (apiData?.results || []).forEach(item => {
            finalResultsMap.set(item.index, item);
        });

        // 3. Adiciona o conteúdo homebrew PÚBLICO à lista, sobressaindo se o index for igual a um oficial, ou adicionando se for novo.
        publicHomebrew.forEach(hb => {
            const officialIndex = hb.content.index;
            // Se o homebrew sobrescreve um item oficial
            if (officialIndex && finalResultsMap.has(officialIndex)) {
                 finalResultsMap.set(officialIndex, {
                    index: officialIndex,
                    name: `(H) ${hb.name}`, // Indica que é uma versão Homebrew de um item oficial
                    url: `/api/dnds/${resource}/${officialIndex}`
                });
            } else { // Se é um conteúdo totalmente novo, usa seu UUID como index
                 finalResultsMap.set(hb.id, {
                    index: hb.id,
                    name: `(H) ${hb.name}`,
                    url: `/api/dnds/${resource}/${hb.id}`
                });
            }
        });
        
        const finalResults = Array.from(finalResultsMap.values()).sort((a,b) => a.name.localeCompare(b.name));
        
        const response = {
            count: finalResults.length,
            results: finalResults,
        };

        return res.json(response);

    } catch (error) {
        next(error);
    }
});


// Rota para buscar detalhes de um recurso específico
router.get('/:resource/:index', async (req, res, next) => {
    const { resource, index } = req.params;
    console.debug(`[Backend Route] GET /dnds/${resource}/${index}`);

    try {
        // Se for um UUID, é definitivamente um homebrew novo
        if (isUuid(index)) {
             const hbContent = await HomebrewService.getHomebrewContentById(index); // userId opcional, valida permissão se privado
             if (!hbContent) return next(createError(404, `Conteúdo homebrew com ID '${index}' não encontrado.`));
             return res.json(hbContent.content);
        }

        // Se não for UUID, pode ser um homebrew que sobrescreve um oficial, ou apenas um oficial
        const homebrewOverride = await HomebrewService.findHomebrewByOfficialIndex(index, resource as HomebrewContentType);
        if (homebrewOverride) {
            console.debug(`[Backend Route] Encontrada sobrescrita homebrew para ${index}.`);
            const officialData = await DndApiService.getDetails(resource, index);
            const mergedData = { ...(officialData || {}), ...homebrewOverride.content, name: homebrewOverride.name, desc: homebrewOverride.content.desc || officialData?.desc };
            return res.json(mergedData);
        }
        
        // Se não houver homebrew, busca na API oficial
        const officialData = await DndApiService.getDetails(resource, index);
        if (!officialData) return next(createError(404, `Detalhes para '${index}' em '${resource}' não encontrados.`));
        return res.json(officialData);

    } catch (error) {
        next(error);
    }
});


// Rota específica para níveis de classe (que tem uma estrutura de URL diferente)
router.get('/classes/:classIndex/levels', async (req, res, next) => {
    const { classIndex } = req.params;
    console.debug(`[Backend Route] Recebida requisição para níveis da classe: ${classIndex}`);
    try {
        let data;
        if (isUuid(classIndex)) {
            const hbContent = await HomebrewService.getHomebrewContentById(classIndex);
            if (!hbContent) {
                return next(createError(404, `Classe homebrew com ID '${classIndex}' não encontrada.`));
            }
            const features = (hbContent.content as any).features || [];
            
            // Simular a estrutura de API para níveis
            const levelsData = Array.from({length: 20}, (_, i) => i + 1).map(level => ({
                level: level,
                features: features.filter((f: any) => f.level === level)
            }));

            data = levelsData;

        } else {
            data = await DndApiService.getDetails('classes', `${classIndex}/levels`);
        }

        if (!data) {
            return next(createError(404, `Níveis para a classe '${classIndex}' não encontrados.`));
        }
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Rota para magias de classe
router.get('/classes/:classIndex/spells', async (req, res, next) => {
    const { classIndex } = req.params;
    console.debug(`[Backend Route] Recebida requisição para magias da classe: ${classIndex}`);
    try {
        if (isUuid(classIndex)) {
             const hbContent = await HomebrewService.getHomebrewContentById(classIndex);
             if (!hbContent) {
                return next(createError(404, `Classe homebrew com ID '${classIndex}' não encontrada.`));
            }
            const spells = (hbContent.content as any).spells || { count: 0, results: [] };
             return res.json(spells);
        }

        const data = await DndApiService.getDetails('classes', `${classIndex}/spells`);
        if (!data) {
            return next(createError(404, `Magias para a classe '${classIndex}' não encontradas.`));
        }
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Rota para níveis de subclasse
router.get('/subclasses/:subclassIndex/levels', async (req, res, next) => {
    const { subclassIndex } = req.params;
    console.debug(`[Backend Route] Recebida requisição para níveis da subclasse: ${subclassIndex}`);
    try {
        let data;
        if (isUuid(subclassIndex)) {
            const hbContent = await HomebrewService.getHomebrewContentById(subclassIndex);
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

        if (!data) {
            return next(createError(404, `Níveis para a subclasse '${subclassIndex}' não encontrados.`));
        }
        res.json(data);
    } catch (error) {
        next(error);
    }
});

export default router;
