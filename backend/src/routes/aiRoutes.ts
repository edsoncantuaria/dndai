// backend/src/routes/aiRoutes.ts
import { Router } from 'express';
import { createHomebrew, generateImage } from '../controllers/aiController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas as rotas de IA são protegidas
router.use(authMiddleware);

router.post('/create-homebrew', createHomebrew);
router.post('/generate-image', generateImage); // Nova rota

export default router;
