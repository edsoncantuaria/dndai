// backend/src/routes/unifiedDataRouter.ts
import { Router } from 'express';
import { getUnifiedList, getUnifiedDetails } from '../services/unifiedDataService.js';
import { authOptional } from '../middlewares/authOptional.js';
import type { Request } from 'express';

// Estendendo a interface Request para incluir a propriedade opcional 'user'
interface OptionalAuthRequest extends Request {
  user?: { id: number };
}

const router = Router();

// Rota para listas de recursos (ex: /api/data/races)
router.get('/:resource', authOptional, async (req: OptionalAuthRequest, res, next) => {
    const { resource } = req.params;
    const userId = req.user?.id;

    try {
        const data = await getUnifiedList(resource, userId);
        // Retorna a lista no formato { count, results } para manter a compatibilidade com a API original.
        res.json({
            count: data.length,
            results: data
        });
    } catch (error) {
        next(error);
    }
});

// Rota para detalhes de um item específico (ex: /api/data/races/elf)
router.get('/:resource/:index', authOptional, async (req: OptionalAuthRequest, res, next) => {
    const { resource, index } = req.params;
    const userId = req.user?.id;

    try {
        const data = await getUnifiedDetails(resource, index, userId);
        if (!data) {
            return res.status(404).json({ message: 'Recurso não encontrado.' });
        }
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Rota para sub-recursos, como níveis de classe
router.get('/:resource/:index/:special', authOptional, async (req: OptionalAuthRequest, res, next) => {
    const { resource, index, special } = req.params;
    const userId = req.user?.id;
    
    // Rota específica para /classes/{index}/levels e /subclasses/{index}/levels
    if ((resource === 'classes' || resource === 'subclasses') && special === 'levels') {
        try {
            // Este serviço já faz chamadas para a API externa (com cache),
            // então não precisa da lógica de unificação complexa.
            const data = await DndApiService.getSpecialDetails(resource, index, special, userId);
            res.json(data);
        } catch (error) {
            next(error);
        }
    } else if(resource === 'classes' && special === 'spells') {
         try {
            const data = await DndApiService.getSpecialDetails(resource, index, special, userId);
            res.json(data);
        } catch (error) {
            next(error);
        }
    }
    else {
        // Se não for uma rota especial conhecida, passa para o próximo middleware (ou 404)
        next();
    }
});


// Importação necessária para a rota especial de níveis
import * as DndApiService from '../services/dndApiService.js';

export default router;
