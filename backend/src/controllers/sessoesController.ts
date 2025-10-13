// backend/src/controllers/sessoesController.ts
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import createError from 'http-errors';
import { clearAiInstanceFromCache } from '../services/aiService.js';

// Criar uma nova sessão
export const createSessao = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { nome, apiKey } = req.body;
    const userId = req.user?.userId;

    if (!nome || !apiKey) {
        return next(createError(400, 'Nome da sessão e chave de API são obrigatórios.'));
    }

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const novaSessao = new SessaoIA();
        novaSessao.nome = nome;
        novaSessao.apiKey = apiKey;
        novaSessao.userId = userId!;
        novaSessao.logs = [];

        const sessaoSalva = await sessaoRepository.save(novaSessao);

        res.status(201).json({ message: 'Sessão criada com sucesso!', sessao: sessaoSalva });
    } catch (error) {
        next(error);
    }
};

// Listar todas as sessões do usuário autenticado
export const getSessoes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const sessoes = await sessaoRepository.find({ where: { userId } });
        res.status(200).json(sessoes);
    } catch (error) {
        next(error);
    }
};

// Obter uma sessão específica
export const getSessaoById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const sessao = await sessaoRepository.findOne({
            where: { id: Number(id), userId: userId },
            relations: ['logs'] // Inclui os logs associados
        });

        if (!sessao) {
            return next(createError(404, 'Sessão não encontrada ou você não tem permissão.'));
        }

        res.status(200).json(sessao);
    } catch (error) {
        next(error);
    }
};

// Deletar uma sessão
export const deleteSessao = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const result = await sessaoRepository.delete({ id: Number(id), userId: userId });

        if (result.affected === 0) {
            return next(createError(404, 'Sessão não encontrada ou você não tem permissão para deletá-la.'));
        }
        
        // Limpa a instância de IA do cache para liberar memória
        clearAiInstanceFromCache(Number(id));

        res.status(200).json({ message: 'Sessão deletada com sucesso.' });
    } catch (error) {
        next(error);
    }
};
