// backend/src/routes/unifiedDataRouter.ts
import express from 'express';
import { getUnifiedList, getUnifiedDetails } from '../services/unifiedDataService.js';
import createError from 'http-errors';
import { authOptional } from '../middlewares/authOptional.js'; // Importa o middleware opcional

const router = express.Router();

/**
 * Middleware para autenticação opcional e log.
 * Ele tenta identificar um usuário logado, mas permite o acesso
 * mesmo que não haja token, passando o userId como 0.
 */
router.use(authOptional, (req: any, res, next) => {
  // O middleware authOptional já anexa req.user se o token for válido.
  const userId = req.user?.userId || 0;
  req.userId = userId; // Anexa o userId para uso nas rotas.
  console.log(`[Router] Rota de dados unificada para ${req.path} acionada para userId: ${userId}`);
  next();
});

/**
 * 🔹 GET /api/data/:resource
 * Retorna a lista unificada (oficial + homebrew) para o recurso especificado.
 */
router.get('/:resource', async (req, res, next) => {
  try {
    const { resource } = req.params;
    const userId = (req as any).userId;

    const data = await getUnifiedList(resource, userId);
    res.json(data);
  } catch (err: any) {
    console.error(`[UnifiedDataRouter] Erro em GET /${req.params.resource}:`, err);
    next(createError(500, `Erro ao buscar lista de dados: ${err.message}`));
  }
});

/**
 * 🔹 GET /api/data/:resource/:index e /api/data/:resource/:index/:subindex
 * Rota unificada que lida tanto com detalhes simples quanto com detalhes aninhados (como levels, spells).
 */
router.get('/:resource/:index/:subindex?', async (req, res, next) => {
    try {
        const { resource, index, subindex } = req.params;
        const userId = (req as any).userId;

        // Concatena o subindex se ele existir para formar o caminho completo.
        // Ex: `classes/fighter` + `levels` -> `classes/fighter/levels`
        // Ex: `spells` + `acid-arrow` -> `spells/acid-arrow`
        const fullResourcePath = subindex ? `${resource}/${index}` : resource;
        const finalIndex = subindex || index;
        
        console.log(`[UnifiedDataRouter] Buscando detalhes para: resource='${fullResourcePath}', index='${finalIndex}'`);

        const data = await getUnifiedDetails(fullResourcePath, finalIndex, userId);

        if (!data || (Array.isArray(data) && data.length === 0)) {
            return next(createError(404, `Recurso não encontrado para ${fullResourcePath}/${finalIndex}.`));
        }
        
        res.json(data);
    } catch (err: any) {
        console.error(`[UnifiedDataRouter] Erro em GET /${req.path}:`, err);
        next(createError(500, `Erro ao buscar detalhes do recurso: ${err.message}`));
    }
});

export default router;
