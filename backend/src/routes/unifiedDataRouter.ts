// backend/src/routes/unifiedDataRouter.ts
import { Router } from 'express';
import { getUnifiedList, getUnifiedDetails, getSpecialDetails } from '../services/unifiedDataService.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';

const router = Router();

// A maioria das rotas precisa de autenticação para personalizar a resposta
router.use(authMiddleware);

// Rota genérica para listas de recursos (ex: /api/data/races)
router.get('/:resource', async (req: AuthRequest, res, next) => {
    const { resource } = req.params;
    const userId = req.user!.userId;

    try {
        const data = await getUnifiedList(resource, userId);
        res.json({
            count: data.length,
            results: data
        });
    } catch (error) {
        next(error);
    }
});

// Rota genérica para detalhes de um item (ex: /api/data/races/elf)
router.get('/:resource/:index', async (req: AuthRequest, res, next) => {
    const { resource, index } = req.params;
    const userId = req.user!.userId;

    try {
        const data = await getUnifiedDetails(resource, index, userId);
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Rotas especiais que não se encaixam no padrão :resource/:index
router.get('/:resource/:index/:special', async (req: AuthRequest, res, next) => {
    const { resource, index, special } = req.params;
    const userId = req.user!.userId;
    
    // Apenas rotas como /classes/{class}/levels são permitidas aqui
    if ((resource === 'classes' || resource === 'subclasses') && (special === 'levels' || special === 'spells')) {
        try {
            const data = await getSpecialDetails(resource, index, special, userId);
            res.json(data);
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

export default router;
