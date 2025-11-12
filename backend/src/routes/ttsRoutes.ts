import { Router } from 'express';
import { generateNarrationAudio, presignNarrationAudio } from '../controllers/ttsController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/generate', authMiddleware, generateNarrationAudio);
router.get('/presign', authMiddleware, presignNarrationAudio);

export default router;
