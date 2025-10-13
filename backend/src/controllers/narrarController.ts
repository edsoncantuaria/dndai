// backend/src/controllers/narrarController.ts
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import { getOrCreateAiInstance } from '../services/aiService.js';
import createError from 'http-errors';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { googleAI } from '@genkit-ai/google-genai';
import { User } from '../entities/User.js';

export const narrar = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const { prompt } = req.body;
    const userId = req.user?.userId;

    if (!prompt) {
        return next(createError(400, 'O prompt do jogador é obrigatório.'));
    }

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const userRepository = AppDataSource.getRepository(User);

        // Garante que o usuário só possa acessar sua própria sessão
        const sessao = await sessaoRepository.findOne({ 
            where: { id: Number(sessionId), userId: userId! }
        });

        if (!sessao) {
            return next(createError(404, 'Sessão de IA não encontrada ou você não tem permissão para acessá-la.'));
        }

        // Busca o usuário e sua chave de API mais recente
        const user = await userRepository.findOne({ where: { id: userId! }});
        if (!user?.settings?.apiKey) {
            return next(createError(400, 'A chave de API não está configurada nas suas configurações de usuário.'));
        }
        
        const apiKey = user.settings.apiKey;

        const ai = getOrCreateAiInstance(sessao.id, apiKey);

        const result = await ai.generate({
            model: googleAI.model('gemini-2.5-flash'),
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
