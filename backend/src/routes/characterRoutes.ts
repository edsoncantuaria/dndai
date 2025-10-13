// backend/src/routes/characterRoutes.ts
import { Router } from 'express';
import { createCharacter, getCharacters, getCharacterById, deleteCharacter } from '../controllers/characterController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas as rotas de personagem são protegidas por autenticação
router.use(authMiddleware);

router.post('/', createCharacter);      // Cria um novo personagem
router.get('/', getCharacters);        // Lista os personagens do usuário
router.get('/:id', getCharacterById);  // Pega um personagem específico
router.delete('/:id', deleteCharacter);  // Deleta um personagem (soft delete)

export default router;
