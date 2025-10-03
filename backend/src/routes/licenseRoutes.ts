
import { Router } from 'express';
import * as licenseController from '../controllers/licenseController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.post('/activate', authenticateToken, licenseController.activateLicense);
router.get('/status', authenticateToken, licenseController.getLicenseStatus);

export default router;
