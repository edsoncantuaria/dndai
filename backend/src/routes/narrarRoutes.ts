// backend/src/routes/narrarRoutes.ts
import { Router } from 'express';
import { narrar } from '../controllers/narrarController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * Rota principal para interação com a IA.
 * POST /api/narrar/:sessionId
 * 
 * Recebe um prompt no corpo da requisição e retorna a narração da IA.
 * Pode operar em modo normal (JSON) ou streaming. Para streaming,
 * inclua `"stream": true` no corpo da requisição.
 * 
 * Protegida por autenticação para garantir que apenas o dono da sessão possa interagir.