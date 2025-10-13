// backend/src/controllers/narrarController.ts
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import { getOrCreateAiInstance } from '../services/aiService.js';
import createError from 'http-errors';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { googleAI } from '@genkit-ai/google-genai';

export const narrar = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const { prompt } = req.body;
    const userId = req.user?.userId;

    if (!prompt) {
        return next(createError(400, 'O prompt do jogador é obrigatório.'));
    }

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        // Garante que o usuário só possa acessar sua própria sessão
        const sessao = await sessaoRepository.findOne({ 
            where: { id: Number(sessionId), userId: userId }
        });

        if (!sessao) {
            return next(createError(404, 'Sessão de IA não encontrada ou você não tem permissão para acessá-la.'));
        }

        if (!sessao.apiKey) {
            return next(createError(400, 'A chave de API para esta sessão não está configurada.'));
        }

        const ai = getOrCreateAiInstance(sessao.id, sessao.apiKey);

        const result = await ai.generate({
            model: googleAI.model('gemini-1.5-pro'),
            prompt: prompt,
        });

        const aiResponse = result.text;

        const logRepository = AppDataSource.getRepository(SessionLog);
        const newLog = new SessionLog();
        newLog.sessao = sessao;
        newLog.prompt = prompt;
        newLog.response = aiResponse;
        await logRepository.save(newLog);
        
        res.status(200).json({ response: aiResponse });

    } catch (error) {
        console.error(`Erro ao processar narração para sessão ${sessionId}:`, error);
        next(error);
    }
};
