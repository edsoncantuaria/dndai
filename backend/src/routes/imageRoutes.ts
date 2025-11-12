import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { generateImageController, presignImageController } from '../controllers/imageController.js';

const router = Router();

router.post('/generate', authMiddleware, generateImageController);
router.get('/presign', authMiddleware, presignImageController);

export default router;
