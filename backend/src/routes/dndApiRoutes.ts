// backend/src/routes/dndApiRoutes.ts
import { Router } from 'express';
import * as DndApiService from '../services/dndApiService.js';
import * as HomebrewService from '../services/homebrewService.js';
import createError from 'http-errors';
import fs from 'fs/promises';
import path from 'path';
import { HomebrewContentType } from '../entities/HomebrewContent.js';

const router = Router();

const HOMEBREW_EXTENSIBLE_RESOURCES: HomebrewContentType[] = [
    'races', 'classes', 'subclasses', 'spells', 'items', 'monsters', 'backgrounds', 'feats'
] as HomebrewContentType[];

const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Rota genérica para buscar listas de recursos (raças, classes, etc.)
router.get('/:resource', async (req, res, next) => {
    const resource = req.params.resource as HomebrewContentType;
    console.debug(`[Backend Route] Recebida requisição para o recurso: ${resource}`);

    try {
        const apiPromise = DndApiService.getResourceList(resource);
        let homebrewPromise = Promise.resolve<HomebrewService.HomebrewContent[]>([]);

        if (HOMEBREW_EXTENSIBLE_RESOURCES.includes(resource)) {
            homebrewPromise = HomebrewService.getPublicHomebrewContent(resource);
        }

        const [apiData, homebrewContent] = await Promise.all([apiPromise, homebrewPromise]);
        
        const finalResultsMap = new Map<string, { index: string, name: string, url: string }>();

        // Adiciona o conteúdo oficial primeiro
        (apiData?.results || []).forEach(item => {
            finalResultsMap.set(item.index, item);
        });

        // Sobrescreve com o conteúdo homebrew onde os índices correspondem
        homebrewContent.forEach(hb => {
            // Se o conteúdo homebrew é uma tradução/sobrescrita de um item oficial
            if (hb.content.index && finalResultsMap.has(hb.content.index)) {
                 finalResultsMap.set(hb.content.index, {
                    index: hb.content.index,
                    name: hb.content.name, // Usa o nome traduzido
                    url: `/api/dnds/${resource}/${hb.content.index}`
                });
            } else { // Se é um conteúdo totalmente novo
                 finalResultsMap.set(hb.id, {
                    index: hb.id,
                    name: `(H) ${hb.name}`,
                    url: `/api/dnds/${resource}/${hb.id}`
                });
            }
        });
        
        const finalResults = Array.from(finalResultsMap.values());
        
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
    console.debug(`[Backend Route] Recebida requisição para detalhes: ${resource}/${index}`);

    try {
        // 1. Tenta buscar um homebrew que sobrescreve o conteúdo oficial
        const translatedContent = await HomebrewService.findHomebrewContentByName(index, resource as HomebrewContentType);
        if (translatedContent) {
            console.debug(`[Backend Route] Encontrada tradução/sobrescrita homebrew para ${index}.`);
            return res.json(translatedContent.content);
        }

        // 2. Se não for tradução, verifica se é um ID de homebrew novo
        if (isUuid(index)) {
             console.debug(`[Backend Route] ID é um UUID, buscando no HomebrewService.`);
             const hbContent = await HomebrewService.getHomebrewContentById(index);
             if (!hbContent) {
                return next(createError(404, `Conteúdo homebrew com ID '${index}' não encontrado.`));
             }
             return res.json(hbContent.content);
        }
        
        // 3. Se nada for encontrado, busca na API oficial
        console.debug(`[Backend Route] ID não é UUID, buscando no DndApiService.`);
        const data = await DndApiService.getDetails(resource, index);
        
        if (!data) {
            console.error(`[Backend Route] Nenhum dado retornado do serviço para: ${resource}/${index}`);
            return next(createError(404, `Detalhes para '${index}' em '${resource}' não encontrados.`));
        }
        return res.json(data);

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
