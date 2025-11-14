import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import createError from 'http-errors';

export const loadStateVersion = async (sessionId: number): Promise<number> => {
    const repo = AppDataSource.getRepository(SessaoIA);
    const session = await repo.findOne({ where: { id: sessionId }, select: ['stateVersion'] });
    return session?.stateVersion ?? 0;
};

export const incrementStateVersion = async (sessionId: number): Promise<number> => {
    const repo = AppDataSource.getRepository(SessaoIA);
    const session = await repo.findOne({ where: { id: sessionId }, select: ['stateVersion'] });
    if (!session) {
        throw createError(404, 'Sessão não encontrada ao atualizar stateVersion.');
    }
    const next = (session?.stateVersion ?? 0) + 1;
    await repo.update({ id: sessionId }, { stateVersion: next });
    return next;
};
