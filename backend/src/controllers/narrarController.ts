// backend/src/controllers/narrarController.ts
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import { getOrCreateAiInstance } from '../services/aiService.js';
import createError from 'http-errors';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { User } from '../entities/User.js';
import { Character } from '../entities/Character.js';
import { GameMasterFlowInputSchema, GameMasterResponseSchema } from '../schemas/gameSchemas.js';
import { promptDnD5e } from '../game/prompt5e.js';
import { genkit } from 'genkit';


// Função auxiliar para reconstruir o objeto completo do personagem para a IA
const buildFullCharacterObjectForAI = async (character: Character | null) => {
    if (!character) return null;

    const fullCharacter = await AppDataSource.getRepository(Character).findOne({
        where: { id: character.id },
        relations: [
            "attributes",
            "proficiencies",
            "items",
            "spells",
            "journal",
            "journal.subLocations",
            "relationships",
 "relationships.quests",
        ],
    });

    if (!fullCharacter) return null;

    const characterData = {
        ...fullCharacter,
        attributes: fullCharacter.attributes,
        proficiencies: fullCharacter.proficiencies,
        inventory: fullCharacter.items.map(item => item.itemData),
        spells: fullCharacter.spells.map(s => s.spellName),
        journal: fullCharacter.journal,
        relationships: fullCharacter.relationships,
    };
    
    delete (characterData as any).items; // Clean up redundant property
    return characterData;
};


export const narrar = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const { prompt: playerAction, combatState: currentCombatState } = req.body;
    const userId = req.user?.userId;

    if (!playerAction) {
        return next(createError(400, 'A ação do jogador é obrigatória.'));
    }

    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const logRepository = AppDataSource.getRepository(SessionLog);
    const userRepository = AppDataSource.getRepository(User);

    try {
        const sessao = await sessaoRepository.findOne({ 
            where: { id: Number(sessionId), userId: userId! },
            relations: ["character"]
        });

        if (!sessao || !sessao.character) {
            return next(createError(404, 'Sessão de IA ou personagem não encontrado.'));
        }

        const user = await userRepository.findOne({ where: { id: userId! } });
        if (!user?.settings?.apiKey) {
            return next(createError(400, 'A chave de API não está configurada para este usuário.'));
        }

        // Construir o estado completo do personagem
        const fullCharacterObject = await buildFullCharacterObjectForAI(sessao.character);
        if (!fullCharacterObject) {
            return next(createError(404, 'Falha ao carregar os dados completos do personagem.'));
        }
        
        // Obter os últimos logs para dar contexto à IA
        const recentLogs = await logRepository.find({
            where: { sessaoId: sessao.id },
            order: { timestamp: 'DESC' },
            take: 15,
        });

        const gameMasterFlowInput = {
            character: fullCharacterObject,
            playerAction: playerAction,
            gameLog: recentLogs.reverse().map(log => ({type: log.type, content: log.response})), // Formato para IA
            combatState: currentCombatState,
        };

        const ai = getOrCreateAiInstance(sessao.id, user.settings.apiKey);
        
        const prompt = ai.definePrompt(
          {
            name: "gameMasterPrompt",
            input: { schema: GameMasterFlowInputSchema },
            output: { schema: GameMasterResponseSchema },
            prompt: promptDnD5e,
          },
        );

        const result = await prompt(gameMasterFlowInput);
        const aiResponse = result.output;

        if (!aiResponse) {
             return next(createError(500, 'O Mestre de Jogo não conseguiu formular uma resposta.'));
        }
        
        // --- Salvar Log da Ação do Jogador e Resposta da IA ---
        const playerLog = new SessionLog();
        playerLog.sessao = sessao;
        playerLog.prompt = playerAction;
        playerLog.response = `(Ação do Jogador) ${playerAction}`;
        playerLog.type = 'action';
        await logRepository.save(playerLog);
        
        if (aiResponse.logEntries) {
            for (const entry of aiResponse.logEntries) {
                const newLog = new SessionLog();
                newLog.sessao = sessao;
                newLog.prompt = JSON.stringify(gameMasterFlowInput);
                newLog.response = entry.content;
                newLog.type = entry.type;
                newLog.rollResult = entry.rollResult;
                await logRepository.save(newLog);
            }
        }
        
        // TODO: Persistir `updatedCharacter`, `combatState`, etc. no banco de dados.
        // Esta parte é crucial e complexa, envolvendo a atualização de múltiplas entidades
        // e será implementada na próxima fase de "Atualização de Estado do Jogo".
        
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error(`Erro ao processar narração para sessão ${sessionId}:`, error);
        next(error);
    }
};
