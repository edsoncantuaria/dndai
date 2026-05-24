import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
    createCastMember,
    deleteCastMember,
    listCast,
    patchCastMember,
} from '../controllers/sessionCastController.js';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', listCast);
router.post('/', createCastMember);
router.patch('/:memberId', patchCastMember);
router.delete('/:memberId', deleteCastMember);

export default router;
