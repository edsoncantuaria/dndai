// backend/src/routes/unifiedDataRouter.ts
import { Router } from 'express';
import { getUnifiedList, getUnifiedDetails } from '../services/unifiedDataService.js';
import { authOptional } from '../middlewares/authOptional.js';
import type { Request } from 'express';
import * as DndApiService from '../services/dndApiService.js';

// Estendendo a interface Request para incluir a propriedade opcional 'user'
interface OptionalAuthRequest extends Request {
  user?: { id: number };
}

const router = Router();

// Rota para listas de recursos (ex: /api/data/races)
router.get('/:resource', authOptional, async (req: OptionalAuthRequest, res, next) => {
    const { resource } = req.params;
    const userId = req.user?.id;
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
    const userId = req.user?.id;
    console.log(`[Router] Rota de detalhes unificados para /${resource}/${index} acionada para userId: ${userId}`);

    try {
        const data = await getUnifiedDetails(resource, index, userId);
        if (!data) {
            return res.status(404).json({ message: 'Recurso não encontrado.' });
        }
        res.json(data);
    } catch (error) {
        console.error(`[Router] Erro em /data/${resource}/${index}:`, error);
        next(error);
    }
});

// Rota para sub-recursos, como níveis de classe
router.get('/:resource/:index/:special', authOptional, async (req: OptionalAuthRequest, res, next) => {
    const { resource, index, special } = req.params;
    const userId = req.user?.id;
    console.log(`[Router] Rota especial para /${resource}/${index}/${special} acionada para userId: ${userId}`);
    
    // Rota específica para /classes/{index}/levels e /subclasses/{index}/levels
    if ((resource === 'classes' || resource === 'subclasses') && special === 'levels') {
        try {
            // Este serviço já faz chamadas para a API externa (com cache),
            // então não precisa da lógica de unificação complexa por enquanto.
            // Futuramente, poderíamos mesclar features de homebrew aqui.
            const data = await DndApiService.getDetails(resource, `${index}/${special}`);
            res.json(data);
        } catch (error) {
            next(error);
        }
    } else if(resource === 'classes' && special === 'spells') {
         try {
            const data = await DndApiService.getDetails(resource, `${index}/${special}`);
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


export default router;
