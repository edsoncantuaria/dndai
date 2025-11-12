import { Router } from 'express';
import { generateNarrationAudio } from '../controllers/ttsController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/generate', authMiddleware, generateNarrationAudio);

export default router;
