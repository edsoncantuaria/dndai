// backend/src/routes/unifiedDataRouter.ts
import { Router } from 'express';
import { getUnifiedList, getUnifiedDetails, getSpecialDetails } from '../services/unifiedDataService.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';

const router = Router();

// Middleware de autenticação opcional
const authOptional = (req: AuthRequest, res: any, next: any) => {
    if (req.headers.authorization) {
        return authMiddleware(req, res, next);
    }
    next();
};

// Rota genérica para listas de recursos (ex: /api/data/races)
router.get('/:resource', authOptional, async (req: AuthRequest, res, next) => {
    const { resource } = req.params;
    const userId = req.user?.userId;

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
router.get('/:resource/:index', authOptional, async (req: AuthRequest, res, next) => {
    const { resource, index } = req.params;
    const userId = req.user?.userId;

    try {
        const data = await getUnifiedDetails(resource, index, userId);
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Rotas especiais que não se encaixam no padrão :resource/:index
router.get('/:resource/:index/:special', authOptional, async (req: AuthRequest, res, next) => {
    const { resource, index, special } = req.params;
    const userId = req.user?.userId;
    
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
