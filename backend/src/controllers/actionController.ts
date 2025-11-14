import type { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { processActionIntent } from '../services/actionService.js';
import { CombatStateSchema } from '../schemas/gameSchemas.js';
import { z } from 'zod';

const processActionSchema = z.object({
    prompt: z.string().min(1).optional(),
    intent: z
        .object({
            type: z.string(),
            payload: z.record(z.any()),
        })
        .optional(),
    combatState: CombatStateSchema.nullable().optional(),
    apiKey: z.string().optional(),
    useAiHomebrew: z.boolean().optional(),
    model: z.string().optional(),
    clientStateVersion: z.number().optional(),
    actionId: z.string().optional(),
});

export const processActionRest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isFinite(sessionId)) {
        return next(createError(400, 'Parâmetro sessionId inválido.'));
    }

    const validation = processActionSchema.safeParse(req.body);
    if (!validation.success) {
        return next(createError(400, 'Payload inválido para processAction.', { details: validation.error.flatten() }));
    }

    try {
        const payload = await processActionIntent({
            sessionId,
            userId: req.user!.userId,
            body: validation.data,
        });
        res.status(200).json(payload);
    } catch (error) {
        next(error);
    }
};
