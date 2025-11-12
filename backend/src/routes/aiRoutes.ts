// backend/src/routes/aiRoutes.ts
import { Router } from 'express';
import { createHomebrew, listEnemyTemplates, createEnemyTemplate, updateEnemyTemplate, deleteEnemyTemplate } from '../controllers/aiController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas as rotas de IA são protegidas
router.use(authMiddleware);

router.post('/create-homebrew', createHomebrew);
router.get('/enemy-templates', listEnemyTemplates);
router.post('/enemy-templates', createEnemyTemplate);
router.put('/enemy-templates/:slug', updateEnemyTemplate);
router.delete('/enemy-templates/:slug', deleteEnemyTemplate);

export default router;
