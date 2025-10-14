// backend/src/controllers/sessoesController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as SessaoService from '../services/sessaoService.js';
import { CreateSessaoSchema } from '../schemas/validationSchemas.js';
import createError from 'http-errors';

// Criar ou obter uma nova sessão de jogo para um personagem
export const createSessao = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }

    try {
        const { nome, characterId } = CreateSessaoSchema.parse(req.body);
        const { sessao, isNew } = await SessaoService.getOrCreateSessao(nome, characterId, userId);

        res.status(isNew ? 201 : 200).json({ 
            message: isNew ? 'Sessão criada com sucesso!' : 'Sessão existente encontrada.', 
            sessao 
        });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
};

// Listar todas as sessões do usuário autenticado
export const getSessoes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }

    try {
        const sessoes = await SessaoService.getSessoesForUser(userId);
        res.status(200).json(sessoes);
    } catch (error) {
        next(error);
    }
};

// Obter uma sessão específica com seus logs
export const getSessaoById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }
    
    const sessionIdNum = Number(id);
    if (isNaN(sessionIdNum)) {
        return next(createError(400, 'ID de sessão inválido.'));
    }

    try {
        const sessao = await SessaoService.getSessaoDetails(sessionIdNum, userId);
        res.status(200).json(sessao);
    } catch (error) {
        next(error);
    }
};

// Deletar uma sessão (soft delete)
export const deleteSessao = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }

    const sessionIdNum = Number(id);
    if (isNaN(sessionIdNum)) {
        return next(createError(400, 'ID de sessão inválido.'));
    }

    try {
        await SessaoService.deleteSessao(sessionIdNum, userId);
        res.status(200).json({ message: 'Sessão movida para a lixeira com sucesso.' });
    } catch (error) {
        next(error);
    }
};
