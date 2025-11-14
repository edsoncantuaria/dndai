import type { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { processActionIntent } from '../services/actionService.js';
import {
    ProcessActionSchema,
    CURRENT_CONTRACT_VERSION,
    ProcessActionPayload,
    isContractVersionSupported,
} from '../schemas/processActionSchema.js';

export const processActionRest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isFinite(sessionId)) {
        return next(createError(400, 'Parâmetro sessionId inválido.'));
    }

    const validation = ProcessActionSchema.safeParse(req.body);
    if (!validation.success) {
        return next(createError(400, 'Payload inválido para processAction.', { details: validation.error.flatten() }));
    }

    const bodyPayload: ProcessActionPayload = validation.data;
    if (!isContractVersionSupported(bodyPayload.contractVersion)) {
        return next(createError(426, `CONTRACT_VERSION_MISMATCH: supported=${CURRENT_CONTRACT_VERSION}`));
    }

    try {
        const payload = await processActionIntent({
            sessionId,
            userId: req.user!.userId,
            body: bodyPayload,
        });
        res.status(200).json(payload);
    } catch (error) {
        next(error);
    }
};
