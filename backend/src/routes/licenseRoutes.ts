// backend/src/routes/licenseRoutes.ts
import { Router } from 'express';
import { activateLicense, getLicenseStatus } from '../controllers/licenseController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/activate', authMiddleware, activateLicense);
router.get('/status', authMiddleware, getLicenseStatus);

export default router;
