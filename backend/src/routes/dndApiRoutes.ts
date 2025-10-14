// backend/src/routes/dndApiRoutes.ts
import { Router } from 'express';
import * as DndApiService from '../services/dndApiService.js';
import createError from 'http-errors';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// Rota genérica para buscar listas de recursos (raças, classes, etc.)
router.get('/:resource', async (req, res, next) => {
    const { resource } = req.params;
    console.log(`[Backend Route] Recebida requisição para o recurso: ${resource}`);

    // --- Início da Lógica Homebrew/Custom Data ---
    // Se a requisição for para 'backgrounds', lemos do nosso arquivo local.
    if (resource === 'backgrounds') {
        try {
            const filePath = path.resolve(process.cwd(), 'src/data/backgrounds.json');
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(fileContent);
            return res.json(data);
        } catch (error) {
            console.error('[Homebrew] Erro ao ler o arquivo de backgrounds:', error);
            return next(createError(500, 'Falha ao carregar dados de antecedentes customizados.'));
        }
    }
    // --- Fim da Lógica Homebrew ---

    try {
        const data = await DndApiService.getResourceList(resource);
        if (!data) {
            console.error(`[Backend Route] Nenhum dado retornado do serviço para: ${resource}`);
            return next(createError(404, `Recurso '${resource}' não encontrado.`));
        }
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Rota para buscar detalhes de um recurso específico
router.get('/:resource/:index', async (req, res, next) => {
    const { resource, index } = req.params;
    console.log(`[Backend Route] Recebida requisição para detalhes: ${resource}/${index}`);
    try {
        const data = await DndApiService.getDetails(resource, index);
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
        const data = await DndApiService.getDetails('classes', `${classIndex}/levels`);
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
