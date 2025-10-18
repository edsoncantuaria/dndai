// backend/src/routes/unifiedDataRouter.ts
import express from 'express';
import { getUnifiedList, getUnifiedDetails } from '../services/unifiedDataService.js';
import createError from 'http-errors';

const router = express.Router();

/**
 * Middleware simples para log de requisições e userId.
 */
router.use((req, res, next) => {
  const userId = req.user?.id || parseInt(req.headers['x-user-id'] as string) || 0;
  console.log(`[Router] Rota de lista unificada para ${req.path} acionada para userId: ${userId}`);
  (req as any).userId = userId;
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
  } catch (err) {
    console.error(`[UnifiedDataRouter] Erro em GET /${req.params.resource}:`, err);
    next(createError(500, 'Erro ao buscar lista de dados.'));
  }
});

/**
 * 🔹 GET /api/data/:resource/:index
 * Retorna os detalhes unificados (oficial + homebrew) de um item específico.
 */
router.get('/:resource/:index', async (req, res, next) => {
  try {
    const { resource, index } = req.params;
    const userId = (req as any).userId;

    const data = await getUnifiedDetails(resource, index, userId);
    if (!data) return next(createError(404, 'Recurso não encontrado.'));
    res.json(data);
  } catch (err) {
    console.error(`[UnifiedDataRouter] Erro em GET /${req.params.resource}/${req.params.index}:`, err);
    next(createError(500, 'Erro ao buscar detalhes do recurso.'));
  }
});

export default router;
