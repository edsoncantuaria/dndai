// backend/src/routes/sessoesRoutes.ts
import { Router } from 'express';
import { createSessao, getSessoes, getSessaoById, deleteSessao, updateHomebrewInstallation as updateSessaoHomebrew } from '../controllers/sessoesController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas as rotas de sessão são protegidas por autenticação
router.use(authMiddleware);

router.post('/', createSessao);
router.get('/', getSessoes);
router.get('/:id', getSessaoById);
router.delete('/:id', deleteSessao);
router.patch('/:id/homebrew', updateSessaoHomebrew); // Nova Rota

export default router;
