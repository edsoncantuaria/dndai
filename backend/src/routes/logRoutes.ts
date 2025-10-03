
import { Router } from 'express';
// Importe o controller de logs aqui quando for criado
// Ex: import * as logController from '../controllers/logController';
import { authenticateToken } from '../middlewares/authMiddleware';
import { blockNonAdmins } from '../middlewares/adminMiddleware'; // Exemplo de middleware de admin

const router = Router();

// Proteger rotas de log para que apenas admins possam acessá-las
router.use(authenticateToken, blockNonAdmins);

// Exemplo de rotas
// router.get('/', logController.getAllLogs);
// router.get('/user/:userId', logController.getLogsByUser);

export default router;
