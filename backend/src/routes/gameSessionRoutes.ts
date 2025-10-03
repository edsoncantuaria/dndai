
import { Router } from 'express';
import * as gameSessionController from '../controllers/gameSessionController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticateToken);

router.post('/', gameSessionController.createGameSession);
router.get('/character/:characterId', gameSessionController.getLatestSessionForCharacter);
router.post('/action', gameSessionController.processPlayerAction);

export default router;
