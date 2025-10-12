
// backend/src/routes/narrarRoutes.ts
import { Router } from 'express';
import { narrar } from '../controllers/narrarController.js';

const router = Router();

/**
 * Rota principal para interação com a IA.
 * POST /api/narrar/:sessionId
 * 
 * Recebe um prompt no corpo da requisição e retorna a narração da IA.
 */
router.post('/:sessionId', narrar);

export default router;
