// backend/src/routes/homebrewRoutes.ts
import { Router } from 'express';
import { createContent, listContent, getContentById, updateContent, getDependencies } from '../controllers/homebrewController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Rota para criar um novo conteúdo - Requer autenticação
router.post('/', authMiddleware, createContent);

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

// Rota para atualizar um conteúdo
router.put('/:id', authMiddleware, updateContent);

// Rota para obter dependências de um conteúdo
router.get('/:id/dependencies', getDependencies);


export default router;
