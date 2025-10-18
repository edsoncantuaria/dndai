// backend/src/routes/unifiedEquipmentRouter.ts
import express from 'express';
import { getUnifiedEquipment } from '../services/unifiedEquipmentService.js';
import createError from 'http-errors';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const data = await getUnifiedEquipment();
    res.json(data);
  } catch (error) {
    next(createError(500, 'Falha ao buscar e unificar os dados de equipamento.'));
  }
});

export default router;
