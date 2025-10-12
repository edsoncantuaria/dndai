
// backend/src/controllers/narrarController.ts
import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import { getOrCreateAiInstance } from '../services/aiService.js';
import createError from 'http-errors';

export const narrar = async (req: Request, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const { prompt } = req.body;

    if (!prompt) {
        return next(createError(400, 'O prompt do jogador é obrigatório.'));
    }

    try {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const sessao = await sessaoRepository.findOneBy({ id: Number(sessionId) });

        if (!sessao) {
            return next(createError(404, 'Sessão de IA não encontrada.'));
        }

        if (!sessao.apiKey) {
            return next(createError(400, 'A chave de API para esta sessão não está configurada.'));
        }

        // Obtém (ou cria e armazena em cache) a instância de IA para esta sessão
        const ai = getOrCreateAiInstance(sessao.id, sessao.apiKey);

        // Gera a resposta da IA
        const result = await ai.generate({
            prompt: prompt,
            // Aqui você pode adicionar mais configurações do Genkit, como `temperature`, `model`, etc.
        });

        const aiResponse = result.text;

        // Salva o log da interação no banco de dados
        const logRepository = AppDataSource.getRepository(SessionLog);
        const newLog = new SessionLog();
        newLog.sessao = sessao;
        newLog.prompt = prompt;
        newLog.response = aiResponse;
        await logRepository.save(newLog);
        
        // Retorna a resposta da IA para o frontend
        res.status(200).json({ response: aiResponse });

    } catch (error) {
        console.error(`Erro ao processar narração para sessão ${sessionId}:`, error);
        // Passa o erro para o middleware de tratamento de erros
        next(error);
    }
};
