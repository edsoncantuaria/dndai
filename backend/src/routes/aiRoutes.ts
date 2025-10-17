// backend/src/routes/aiRoutes.ts
import { Router } from 'express';
import { createHomebrew } from '../controllers/aiController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Protege a rota para garantir que apenas usuários autenticados possam usar os recursos de IA
router.use(authMiddleware);

router.post('/create-homebrew', createHomebrew);

// Futuramente, podemos adicionar rotas para TTS e Geração de Imagem aqui.
// router.post('/generate-image', generateImage);
// router.post('/text-to-speech', textToSpeech);

export default router;
