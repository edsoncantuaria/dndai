// backend/src/routes/dndApiRoutes.ts
import { Router } from 'express';
import * as DndApiService from '../services/dndApiService.js';
import * as HomebrewService from '../services/homebrewService.js';
import createError from 'http-errors';
import fs from 'fs/promises';
import path from 'path';
import { HomebrewContentType } from '../entities/HomebrewContent.js';

const router = Router();

// Tipos de conteúdo que podem ser estendidos com homebrew.
const HOMEBREW_EXTENSIBLE_RESOURCES: HomebrewContentType[] = [
    'races', 'classes', 'subclasses', 'spells', 'items', 'monsters', 'backgrounds', 'feats'
] as HomebrewContentType[];

// Helper to check if a string is a UUID
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);


// Rota específica para servir os dados completos do backgrounds.json
router.get('/backgrounds-data', async (req, res, next) => {
    try {
        const filePath = path.join(process.cwd(), 'data', 'backgrounds.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        res.json(data);
    } catch (error) {
        console.error('Erro ao carregar backgrounds.json:', error);
        next(createError(500, 'Falha ao carregar dados de antecedentes.'));
    }
});


// Rota genérica para buscar listas de recursos (raças, classes, etc.)
router.get('/:resource', async (req, res, next) => {
    const resource = req.params.resource as HomebrewContentType;
    console.log(`[Backend Route] Recebida requisição para o recurso: ${resource}`);

    try {
        // Busca os dados da API oficial
        const apiData = await DndApiService.getResourceList(resource);
        let finalResults = apiData?.results || [];

        // Se o recurso for extensível, busca e mescla com o homebrew público.
        if (HOMEBREW_EXTENSIBLE_RESOURCES.includes(resource)) {
            const homebrewContent = await HomebrewService.getPublicHomebrewContent(resource);
            
            if (homebrewContent.length > 0) {
                const homebrewResults = homebrewContent.map(hb => ({
                    index: hb.id, // Usamos o ID do homebrew como índice
                    name: `(H) ${hb.name}`, // Adiciona um prefixo para indicar que é homebrew
                    url: `/api/dnds/${resource}/${hb.id}` // Aponta para a nossa própria API
                }));
                finalResults = [...finalResults, ...homebrewResults];
            }
        }
        
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
    console.log(`[Backend Route] Recebida requisição para detalhes: ${resource}/${index}`);
    try {
        let data;
        if (isUuid(index)) {
             const hbContent = await HomebrewService.getHomebrewContentById(index);
             if (!hbContent) {
                return next(createError(404, `Conteúdo homebrew com ID '${index}' não encontrado.`));
             }
             data = hbContent.content;
        } else {
            data = await DndApiService.getDetails(resource, index);
        }
        
        if (!data) {
            console.error(`[Backend Route] Nenhum dado retornado do serviço para: ${resource}/${index}`);
            return next(createError(404, `Detalhes para '${index}' em '${resource}' não encontrados.`));
        }
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Rota específica para níveis de classe (que tem uma estrutura de URL diferente)
router.get('/classes/:classIndex/levels', async (req, res, next) => {
    const { classIndex } = req.params;
    console.log(`[Backend Route] Recebida requisição para níveis da classe: ${classIndex}`);
    try {
        let data;
        if (isUuid(classIndex)) {
            const hbContent = await HomebrewService.getHomebrewContentById(classIndex);
            if (!hbContent) {
                return next(createError(404, `Classe homebrew com ID '${classIndex}' não encontrada.`));
            }
            // Para classes homebrew, os níveis (features) estão dentro do próprio objeto de conteúdo
            const features = (hbContent.content as any).features || [];
            
            // Simular a estrutura de API para níveis
            const levelsData = Array.from({length: 20}, (_, i) => i + 1).map(level => ({
                level: level,
                features: features.filter((f: any) => f.level === level)
                // Outros dados de nível como prof_bonus podem ser calculados se necessário
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
    console.log(`[Backend Route] Recebida requisição para magias da classe: ${classIndex}`);
    try {
        if (isUuid(classIndex)) {
             const hbContent = await HomebrewService.getHomebrewContentById(classIndex);
             if (!hbContent) {
                return next(createError(404, `Classe homebrew com ID '${classIndex}' não encontrada.`));
            }
            // Assumindo que classes homebrew podem ter uma lista de magias em sua estrutura
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


export default router;
