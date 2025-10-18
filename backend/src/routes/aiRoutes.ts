// backend/src/routes/aiRoutes.ts
import { Router } from 'express';
import { createHomebrew } from '../controllers/aiController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas as rotas de IA são protegidas
router.use(authMiddleware);

router.post('/create-homebrew', createHomebrew);

export default router;
