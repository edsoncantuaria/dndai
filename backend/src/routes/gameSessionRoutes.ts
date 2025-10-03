
import { Router } from 'express';
import { authenticateToken, authContext } from '../middlewares/authMiddleware';
import { expressHandler } from '@genkit-ai/express';
import { gameMasterFlow } from '../services/iaService';

const router = Router();

// Protege todas as rotas de sessão de jogo com autenticação de token
router.use(authenticateToken);

// O endpoint de ação do jogo agora é gerenciado diretamente pelo Genkit.
// O 'authenticateToken' garante que o token JWT é válido antes de prosseguir.
// O 'authContext' é passado para o expressHandler para que o fluxo do Genkit
// possa acessar com segurança o ID do usuário autenticado.
router.post(
    '/action',
    expressHandler(gameMasterFlow, {
      contextProvider: authContext,
    })
);

export default router;
