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
        const validatedData = CreateSessaoSchema.parse(req.body);
        const { sessao, isNew } = await SessaoService.getOrCreateSessao(validatedData, userId);

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

// Atualizar o conteúdo homebrew de uma sessão
export const updateSessaoHomebrew = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { homebrewId, action } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
        return next(createError(401, 'Usuário não autenticado.'));
    }

    const sessionIdNum = Number(id);
    if (isNaN(sessionIdNum)) {
        return next(createError(400, 'ID de sessão inválido.'));
    }

    if (!homebrewId || (action !== 'install' && action !== 'uninstall')) {
        return next(createError(400, 'ID do Homebrew e ação (install/uninstall) são obrigatórios.'));
    }

    try {
        const updatedSessao = await SessaoService.updateHomebrewInstallation(sessionIdNum, userId, homebrewId, action);
        res.status(200).json({
            message: `Conteúdo homebrew ${action === 'install' ? 'instalado' : 'desinstalado'} com sucesso!`,
            sessao: updatedSessao
        });
    } catch (error) {
        next(error);
    }
};
