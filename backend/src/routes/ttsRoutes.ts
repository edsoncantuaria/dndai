import { Router } from 'express';
import {
  generateNarrationAudio,
  presignNarrationAudio,
  streamNarrationAudio,
} from '../controllers/ttsController.js';
import { authMiddleware, authMiddlewareAllowQueryToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/generate', authMiddleware, generateNarrationAudio);
router.get('/audio', authMiddlewareAllowQueryToken, streamNarrationAudio);
router.get('/presign', authMiddleware, presignNarrationAudio);

export default router;
