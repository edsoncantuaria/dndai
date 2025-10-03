import { Express, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { AppDataSource } from '../config/data-source';
import { User } from '../entities/User';
import { decrypt } from '../utils/crypto';
import { gameMasterFlow, testAiConnectionFlow } from '../services/geminiService';
import { Character } from '../entities/Character';
import { GameSession } from '../entities/GameSession';

export function setupGameRoutes(app: Express) {

    // Rota principal para ações do jogo
    app.post('/api/game/action', authenticateToken, async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const { characterId, action, gameLog, combatState } = req.body;

        if (!characterId || action === undefined) {
            return res.status(400).json({ message: "CharacterId e uma ação são obrigatórios." });
        }

        try {
            // 1. Obter a chave de API do usuário
            const userRepository = AppDataSource.getRepository(User);
            const user = await userRepository.findOne({ where: { id: userId } });
            if (!user || !user.googleApiKeyEncrypted) {
                return res.status(403).json({ message: "Chave de API do Google não encontrada ou inválida para este usuário." });
            }
            const apiKey = decrypt(user.googleApiKeyEncrypted);
            if (!apiKey) {
                return res.status(500).json({ message: "Falha ao descriptografar a chave de API." });
            }

            // 2. Carregar o estado do personagem
            const characterRepository = AppDataSource.getRepository(Character);
            const character = await characterRepository.findOne({ where: { id: characterId, userId: userId } });
            if (!character) {
                return res.status(404).json({ message: "Personagem não encontrado." });
            }

            // 3. Montar o input para o fluxo da IA
            const flowInput = {
                character: character.characterData,
                playerAction: action,
                gameLog: gameLog || [],
                combatState: combatState || { isActive: false },
                apiKey: apiKey, // Adiciona a chave de API diretamente ao input
            };

            // 4. Executar o fluxo da IA
            const response = await gameMasterFlow(flowInput);

            // 5. Processar e salvar o novo estado
            if (response.updatedCharacter) {
                character.characterData = { ...character.characterData as object, ...response.updatedCharacter };
                character.last_played_at = new Date();
                // TODO: Adicionar lógica para calcular e incrementar `total_play_time_seconds`
                await characterRepository.save(character);
            }
            
            const sessionRepository = AppDataSource.getRepository(GameSession);
            const newGameSession = sessionRepository.create({
                character: character,
                gameState: { log: response.logEntries, combatState: response.combatState },
            });
            await sessionRepository.save(newGameSession);


            // 6. Retornar a resposta da IA para o cliente
            res.status(200).json(response);

        } catch (error: any) {
            console.error("Erro no endpoint /api/game/action:", error);
            res.status(500).json({ message: "Erro interno do servidor ao processar a ação do jogo.", details: error.message });
        }
    });

    // Rota de teste da IA
    app.post('/api/test-ai', authenticateToken, async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const { model, prompt } = req.body;

         if (!model || !prompt) {
            return res.status(400).json({ message: "Modelo e prompt são obrigatórios." });
        }

        try {
            const userRepository = AppDataSource.getRepository(User);
            const user = await userRepository.findOne({ where: { id: userId } });
            if (!user || !user.googleApiKeyEncrypted) {
                return res.status(403).json({ message: "Chave de API do Google não encontrada ou inválida." });
            }
            const apiKey = decrypt(user.googleApiKeyEncrypted);
            if (!apiKey) {
                return res.status(500).json({ message: "Falha ao descriptografar a chave de API." });
            }

            const result = await testAiConnectionFlow({ model, prompt, apiKey });
            res.status(200).json({ success: true, response: result });

        } catch (error: any) {
            console.error("Erro no endpoint /api/test-ai:", error);
            res.status(500).json({ message: "Erro ao testar a conexão com a IA.", details: error.message });
        }
    });
}
