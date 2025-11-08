// backend/src/routes/sessoesRoutes.ts
import { Router } from 'express';
import { 
    createSessao, 
    getSessoes, 
    getSessaoById, 
    deleteSessao, 
    updateHomebrewInstallation, 
    getSessaoFacts, 
    getSessaoReplayMarkdown, 
    renameSessao, 
    cloneSessao 
} from '../controllers/sessoesController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas as rotas de sessão são protegidas por autenticação
router.use(authMiddleware);

router.post('/', createSessao);
router.get('/', getSessoes);
router.get('/:id', getSessaoById);
router.get('/:id/facts', getSessaoFacts);
router.get('/:id/replay', getSessaoReplayMarkdown);
router.delete('/:id', deleteSessao);
router.patch('/:id/homebrew', updateHomebrewInstallation); 
router.patch('/:id', renameSessao); // Rota para renomear
router.post('/:id/clone', cloneSessao);

export default router;
