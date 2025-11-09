// backend/src/routes/regionRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { adminOnly } from '../middlewares/adminMiddleware.js';
import {
  listRegions,
  getRegion,
  createRegion,
  updateRegion,
  deleteRegion,
  createRegionLink,
  updateRegionLink,
  deleteRegionLink,
  createPointOfInterest,
  updatePointOfInterest,
  deletePointOfInterest,
  generateRegionDraft,
  exportRegionGraph,
  importRegionGraph,
} from '../controllers/regionController.js';

const router = Router();

// Público (visualização do mapa)
router.get('/', listRegions);
router.get('/export', authMiddleware, adminOnly, exportRegionGraph);
router.get('/:slug', getRegion);

// Admin: Regiões
router.post('/', authMiddleware, adminOnly, createRegion);
router.put('/:id', authMiddleware, adminOnly, updateRegion);
router.delete('/:id', authMiddleware, adminOnly, deleteRegion);

// Admin: Links
router.post('/links', authMiddleware, adminOnly, createRegionLink);
router.put('/links/:id', authMiddleware, adminOnly, updateRegionLink);
router.delete('/links/:id', authMiddleware, adminOnly, deleteRegionLink);

// Admin: Pontos de interesse
router.post('/pois', authMiddleware, adminOnly, createPointOfInterest);
router.put('/pois/:id', authMiddleware, adminOnly, updatePointOfInterest);
router.delete('/pois/:id', authMiddleware, adminOnly, deletePointOfInterest);

// Admin: IA helper
router.post('/ai/generate', authMiddleware, adminOnly, generateRegionDraft);
router.post('/import', authMiddleware, adminOnly, importRegionGraph);

export default router;
