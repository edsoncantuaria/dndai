
import { Router } from 'express';
import * as gameSessionController from '../controllers/gameSessionController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { expressHandler } from '@genkit-ai/express';
import { gameMasterFlow } from '../services/iaService';

const router = Router();

router.use(authenticateToken);

router.post('/', gameSessionController.createGameSession);
router.get('/character/:characterId', gameSessionController.getLatestSessionForCharacter);

// Use o expressHandler para expor o fluxo de streaming diretamente
router.post('/action', expressHandler({ flow: gameMasterFlow }));


export default router;
