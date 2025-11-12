import type { Response, NextFunction } from 'express';
import createError from 'http-errors';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { clearAllPendingRollRequestsForUser } from '../services/rollRequestService.js';

export const clearPendingRollsForUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            throw createError(401, 'Usuário não autenticado.');
        }
        const clearedSessions = await clearAllPendingRollRequestsForUser(userId);
        res.json({
            clearedSessions,
            message: clearedSessions
                ? 'Rolagens pendentes limpas.'
                : 'Nenhuma rolagem pendente encontrada.',
        });
    } catch (error) {
        next(error);
    }
};
