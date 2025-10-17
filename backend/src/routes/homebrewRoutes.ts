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
router.get('/bundles', (req, res, next) => {
    if (req.query.scope === 'mine') {
        return authMiddleware(req as any, res, next);
    }
    next();
}, listBundles);
router.get('/bundles/:id/contents', getBundleContents);
router.put('/bundles/:id', authMiddleware, updateBundle);
router.delete('/bundles/:id', authMiddleware, deleteBundle);


// --- Content ---
router.post('/check-name', authMiddleware, checkName);
router.post('/', authMiddleware, createContent);

router.get('/', (req, res, next) => {
    if (req.query.scope === 'mine') {
        return authMiddleware(req as any, res, next);
    }
    next();
}, listContent);


router.get('/:id', getContentById);
router.put('/:id', authMiddleware, updateContent);
// A rota de delete foi desabilitada conforme a regra de negócio
// router.delete('/:id', authMiddleware, deleteContent); 
router.get('/:id/dependencies', getDependencies);


export default router;
