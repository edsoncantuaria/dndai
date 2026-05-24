import type { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import {
    addSessionCastMember,
    listSessionCast,
    removeSessionCastMember,
    updateSessionCastMember,
} from '../services/sessionCastService.js';
import type { CastRole, CastVitals } from '../entities/SessionCastMember.js';

const ROLES = new Set<CastRole>(['pc', 'npc', 'ally', 'enemy']);
const VITALS = new Set<CastVitals>(['alive', 'dead', 'unconscious', 'unknown']);

export const listCast = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = Number(req.params.sessionId);
        const userId = (req as any).user?.id;
        if (!userId) throw createError(401, 'Não autenticado.');
        const cast = await listSessionCast(sessionId, userId);
        res.json(cast);
    } catch (err) {
        next(err);
    }
};

export const createCastMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = Number(req.params.sessionId);
        const userId = (req as any).user?.id;
        if (!userId) throw createError(401, 'Não autenticado.');
        const { displayName, role, vitals, characterId, sheetSnapshot, metadata, visibleToParty } =
            req.body ?? {};
        if (!displayName?.trim()) throw createError(400, 'displayName é obrigatório.');
        if (!role || !ROLES.has(role)) throw createError(400, 'role inválido.');
        if (vitals && !VITALS.has(vitals)) throw createError(400, 'vitals inválido.');
        const member = await addSessionCastMember(sessionId, userId, {
            displayName,
            role,
            vitals,
            characterId: characterId ?? null,
            sheetSnapshot,
            metadata,
            visibleToParty,
        });
        res.status(201).json(member);
    } catch (err) {
        next(err);
    }
};

export const patchCastMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = Number(req.params.sessionId);
        const memberId = Number(req.params.memberId);
        const userId = (req as any).user?.id;
        if (!userId) throw createError(401, 'Não autenticado.');
        const member = await updateSessionCastMember(sessionId, userId, memberId, req.body ?? {});
        res.json(member);
    } catch (err) {
        next(err);
    }
};

export const deleteCastMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sessionId = Number(req.params.sessionId);
        const memberId = Number(req.params.memberId);
        const userId = (req as any).user?.id;
        if (!userId) throw createError(401, 'Não autenticado.');
        await removeSessionCastMember(sessionId, userId, memberId);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};
