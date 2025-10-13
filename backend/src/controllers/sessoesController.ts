// backend/src/controllers/sessoesController.ts
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import createError from 'http-errors';
import { clearAiInstanceFromCache } from '../services/aiService.js';
import { IsNull } from 'typeorm';
import { Character } from '../entities/Character.js';

// Criar uma nova sessão de jogo para um personagem existente
export const createSessao = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { nome, characterId } = req.body;
    const userId = req.user?.userId;

    if (!nome || !characterId) {
        return next(createError(400, 'Nome da sessão e ID do personagem são obrigatórios.'));
    }

    try {
        const characterRepository = AppDataSource.getRepository(Character);
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);

        // Verifica se o personagem pertence ao usuário logado
        const character = await characterRepository.findOne({ where: { id: characterId, userId: userId! } });
        if (!character) {
            return next(createError(404, 'Personagem não encontrado ou você não tem permissão para usá-lo.'));
        }

        const novaSessao = new SessaoIA();
        novaSessao.nome = nome;
        novaSessao.character = character;
        novaSessao.userId = userId!;
        novaSessao.apiKey = "TEMP_API_KEY_PLACEHOLDER"; // A API key agora pode vir do usuário ou de outro lugar
        novaSessao.logs = [];

        const sessaoSalva = await sessaoRepository.save(novaSessao);

        // Retorna a sessão sem dados sensíveis como a chave de API
        const { apiKey, ...sessaoParaRetorno } = sessaoSalva;

        res.status(201).json({ message: 'Sessão criada com sucesso!', sessao: sessaoParaRetorno });
    } catch (error) {
        next(error);
    }
};


// Listar todas as sessões do usuário autenticado
export const getSessoes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const sessoes = await sessaoRepository.find({
            where: { userId: userId!, deletedAt: IsNull() },
            relations: ['character'], // Inclui os dados básicos do personagem
            select: {
                id: true,
                nome: true,
                createdAt: true,
                updatedAt: true,
                character: {
                    id: true,
                    name: true,
                    level: true,
                    characterClass: true,
                    race: true,
                }
            }
        });
        res.status(200).json(sessoes);
    } catch (error) {
        next(error);
    }
};

// Obter uma sessão específica com seus logs
export const getSessaoById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const sessao = await sessaoRepository.findOne({
            where: { id: Number(id), userId: userId!, deletedAt: IsNull() },
            relations: ['logs', 'character'] // Inclui os logs e os dados completos do personagem
        });

        if (!sessao) {
            return next(createError(404, 'Sessão não encontrada ou você não tem permissão.'));
        }
        
        // Remove a chave de API antes de enviar a resposta
        const { apiKey, ...sessaoSegura } = sessao;

        res.status(200).json(sessaoSegura);
    } catch (error) {
        next(error);
    }
};


// Deletar uma sessão (agora usando soft delete)
export const deleteSessao = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const result = await sessaoRepository.softDelete({ id: Number(id), userId: userId! });

        if (result.affected === 0) {
            return next(createError(404, 'Sessão não encontrada ou você não tem permissão para deletá-la.'));
        }
        
        clearAiInstanceFromCache(Number(id));

        res.status(200).json({ message: 'Sessão movida para a lixeira com sucesso.' });
    } catch (error) {
        next(error);
    }
};
