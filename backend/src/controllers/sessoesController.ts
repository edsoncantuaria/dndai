// backend/src/controllers/sessoesController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as SessaoService from '../services/sessaoService.js';
import { CreateSessaoSchema } from '../schemas/validationSchemas.js';
import createError from 'http-errors';

// Criar uma nova sessão de jogo clonando um personagem
export const createSessao = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }

    try {
        const validatedData = CreateSessaoSchema.parse(req.body);
        // A função getOrCreateSessao agora sempre cria uma nova sessão com um personagem clonado
        const { sessao, isNew } = await SessaoService.getOrCreateSessao(validatedData, userId);

        res.status(201).json({ 
            message: 'Sessão criada com sucesso!', 
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

// Deletar uma sessão E o personagem clonado associado a ela
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
        res.status(200).json({ message: 'Sessão e personagem associado foram movidos para a lixeira com sucesso.' });
    } catch (error) {
        next(error);
    }
};

// Adicionar ou remover homebrew de uma sessão
export const updateHomebrewInstallation = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;
     if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }

    const { homebrewId, action } = req.body;
    if (!homebrewId || !['install', 'uninstall'].includes(action)) {
        return next(createError(400, 'homebrewId e action (install/uninstall) são obrigatórios.'));
    }

    const sessionIdNum = Number(id);
    if (isNaN(sessionIdNum)) {
        return next(createError(400, 'ID de sessão inválido.'));
    }

    try {
        const updatedSessao = await SessaoService.updateHomebrewInstallation(sessionIdNum, userId, homebrewId, action);
        res.status(200).json({ message: `Conteúdo homebrew atualizado na sessão.`, sessao: updatedSessao });
    } catch(error) {
        next(error);
    }
};

export const getSessaoFacts = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
        const payload = await SessaoService.getSessaoFacts(sessionIdNum, userId);
        res.status(200).json(payload);
    } catch (error) {
        next(error);
    }
};

export const getSessaoReplayMarkdown = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
        const replay = await SessaoService.generateSessionReplayMarkdown(sessionIdNum, userId);
        res.status(200).json(replay);
    } catch (error) {
        next(error);
    }
};

export const renameSessao = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user?.userId;

    if (!userId) return next(createError(401, 'Não autorizado.'));
    if (!name || typeof name !== 'string' || name.length > 42) {
        return next(createError(400, 'Nome inválido ou excede 42 caracteres.'));
    }
    const sessionIdNum = Number(id);
    if (isNaN(sessionIdNum)) return next(createError(400, 'ID de sessão inválido.'));

    try {
        const sessao = await SessaoService.renameSessao(sessionIdNum, userId, name);
        res.status(200).json({ message: "Sessão renomeada.", sessao });
    } catch (error) {
        next(error);
    }
};

export const cloneSessao = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) return next(createError(401, 'Não autorizado.'));
    const sessionIdNum = Number(id);
    if (isNaN(sessionIdNum)) return next(createError(400, 'ID de sessão inválido.'));

    try {
        const { sessao } = await SessaoService.cloneSessao(sessionIdNum, userId);
        res.status(201).json({ message: "Sessão clonada com sucesso.", sessao });
    } catch (error) {
        next(error);
    }
};
