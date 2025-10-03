
import { Router } from 'express';
import * as characterController from '../controllers/characterController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Todas as rotas de personagem exigem autenticação
router.use(authenticateToken);

router.post('/', characterController.createCharacter);
router.get('/', characterController.getAllCharactersForUser);
router.get('/:id', characterController.getCharacterById);
router.put('/:id', characterController.updateCharacter);
router.delete('/:id', characterController.deleteCharacter);

export default router;
