import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { AppDataSource } from '../database/data-source.js';
import { ActionLog } from '../entities/ActionLog.js';
import { GAME_EVENT_PREFIX } from '../events/types.js';
import { Like } from 'typeorm';

/** P0.1.4 — replay de eventos append-only por actionId (debug). */
export async function getGameEventsByAction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const sessionId = Number(req.params.sessionId);
        const actionId = String(req.params.actionId ?? '').trim();
        if (!Number.isFinite(sessionId) || sessionId <= 0) {
            return res.status(400).json({ message: 'sessionId inválido' });
        }
        if (!actionId) {
            return res.status(400).json({ message: 'actionId obrigatório' });
        }

        const repo = AppDataSource.getRepository(ActionLog);
        const rows = await repo.find({
            where: {
                sessionId,
                actionId,
                actionType: Like(`${GAME_EVENT_PREFIX}%`),
            },
            order: { id: 'ASC' },
            take: 200,
        });

        res.json({
            sessionId,
            actionId,
            events: rows.map(row => ({
                id: row.id,
                type: row.actionType?.replace(GAME_EVENT_PREFIX, '') ?? row.actionType,
                stateVersion: row.stateVersion,
                createdAt: row.createdAt,
                metadata: row.metadata,
            })),
        });
    } catch (err) {
        next(err);
    }
}
