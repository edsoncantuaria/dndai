// backend/src/routes/homebrewRoutes.ts
import { Router } from 'express';
import { 
    createContent, 
    listContent, 
    getContentById, 
    updateContent,
    deleteContent,
    getDependencies,
    listBundles,
    getBundleContents,
    createBundle,
    updateBundle,
    deleteBundle,
    checkName
} from '../controllers/homebrewController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// --- Bundles ---
router.post('/bundles', authMiddleware, createBundle);
router.get('/bundles', authMiddleware, listBundles);
router.get('/bundles/:id/contents', getBundleContents);
router.put('/bundles/:id', authMiddleware, updateBundle);
router.delete('/bundles/:id', authMiddleware, deleteBundle);


// --- Content ---
router.post('/check-name', authMiddleware, checkName);
router.post('/', authMiddleware, createContent);

// Rota para listar conteúdos - Aberta, mas pode ter filtros
// A autenticação é opcional aqui para permitir listar conteúdo "meu"
router.get('/', (req, res, next) => {
    if (req.query.scope === 'mine') {
        return authMiddleware(req as any, res, next);
    }
    next();
}, listContent);


// Rota para obter um conteúdo específico - Aberta, pois a lógica de permissão está no serviço
router.get('/:id', getContentById);

// Rota para atualizar um conteúdo
router.put('/:id', authMiddleware, updateContent);

// Rota para excluir um conteúdo
router.delete('/:id', authMiddleware, deleteContent);


// Rota para obter dependências de um conteúdo
router.get('/:id/dependencies', getDependencies);


export default router;
