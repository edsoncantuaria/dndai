// backend/src/routes/unifiedDataRouter.ts
import { Router } from 'express';
import { getUnifiedList, getUnifiedDetails } from '../services/unifiedDataService.js';
import { authOptional } from '../middlewares/authOptional.js';
import type { Request } from 'express';
import createError from 'http-errors';

// Estendendo a interface Request para incluir a propriedade opcional 'user'
interface OptionalAuthRequest extends Request {
  user?: { userId: number };
}

const router = Router();

// Rota para listas de recursos (ex: /api/data/races)
router.get('/:resource', authOptional, async (req: OptionalAuthRequest, res, next) => {
    const { resource } = req.params;
    const userId = req.user?.userId;
    console.log(`[Router] Rota de lista unificada para /${resource} acionada para userId: ${userId}`);

    try {
        const data = await getUnifiedList(resource, userId);
        res.json({
            count: data.length,
            results: data
        });
    } catch (error) {
        console.error(`[Router] Erro em /data/${resource}:`, error);
        next(error);
    }
});

// Rota para detalhes de um item específico (ex: /api/data/races/elf)
router.get('/:resource/:index', authOptional, async (req: OptionalAuthRequest, res, next) => {
    const { resource, index } = req.params;
    const userId = req.user?.userId;
    console.log(`[Router] Rota de detalhes unificados para /${resource}/${index} acionada para userId: ${userId}`);

    try {
        const data = await getUnifiedDetails(resource, index, userId);
        if (!data) {
            return next(createError(404, 'Recurso não encontrado.'));
        }
        res.json(data);
    } catch (error) {
        console.error(`[Router] Erro em /data/${resource}/${index}:`, error);
        next(error);
    }
});

export default router;
