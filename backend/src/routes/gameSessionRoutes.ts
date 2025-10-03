
import { Router } from 'express';
import * as gameSessionController from '../controllers/gameSessionController';
import { authenticateToken, authContext } from '../middlewares/authMiddleware';
import { expressHandler } from '@genkit-ai/express';
import { gameMasterFlow } from '../services/iaService';

const router = Router();

// Protege todas as rotas de sessão de jogo com autenticação de token
router.use(authenticateToken);

router.post('/', gameSessionController.createGameSession);
router.get('/character/:characterId', gameSessionController.getLatestSessionForCharacter);

// Endpoint principal do jogo que utiliza o expressHandler do Genkit.
// O 'authenticateToken' garante que a requisição é válida antes de chegar ao handler.
// O 'authContext' é passado para o handler para que o fluxo do Genkit tenha acesso ao ID do usuário.
router.post(
    '/action',
    expressHandler(gameMasterFlow, {
      context: authContext,
    })
);

export default router;

