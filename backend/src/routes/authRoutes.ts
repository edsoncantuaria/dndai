
import { Router } from 'express';
import * as authController from '../controllers/authController';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
// router.post('/refresh-token', authController.refreshToken); // Para implementação futura
// router.post('/logout', authController.logout); // Para implementação futura

export default router;
