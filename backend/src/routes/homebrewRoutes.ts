// backend/src/routes/homebrewRoutes.ts
import { Router } from 'express';
import { createContent, listContent, getContentById, findContentByName } from '../controllers/homebrewController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Rota para criar um novo conteúdo - Requer autenticação
router.post('/', authMiddleware, createContent);

// Nova rota para encontrar por nome
router.get('/find', findContentByName);

// Rota para listar conteúdos - Aberta, mas pode ter filtros
// A autenticação é opcional aqui para permitir listar conteúdo "meu"
router.get('/', (req, res, next) => {
    // Se o escopo for 'mine', exige autenticação.
    if (req.query.scope === 'mine') {
        return authMiddleware(req as any, res, next);
    }
    next();
}, listContent);


// Rota para obter um conteúdo específico - Aberta, pois a lógica de permissão está no serviço
router.get('/:id', getContentById);

// Rotas para Update e Delete podem ser adicionadas aqui no futuro
// router.put('/:id', authMiddleware, updateContent);
// router.delete('/:id', authMiddleware, deleteContent);

export default router;
