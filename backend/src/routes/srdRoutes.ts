// backend/src/routes/srdRoutes.ts
import { Router } from 'express';
import { listResources, getResource } from '../controllers/srdController.js';

const router = Router();

router.get('/:resource', listResources);
router.get('/:resource/:index', getResource);

export default router;
