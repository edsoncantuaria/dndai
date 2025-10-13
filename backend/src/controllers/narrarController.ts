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
import { CharacterAttributes } from '../entities/CharacterAttributes.js';
import { CharacterItem } from '../entities/CharacterItem.js';
import { CharacterProficiency } from '../entities/CharacterProficiency.js';
import { CharacterSpell } from '../entities/CharacterSpell.js';
import { JournalEntry } from '../entities/JournalEntry.js';
import { Quest } from '../entities/Quest.js';
import { Relationship } from '../entities/Relationship.js';


// Constrói um objeto de personagem otimizado para a IA, focando no que é relevante para a jogabilidade.
const buildOptimizedCharacterForAI = async (character: Character | null) => {
    if (!character) return null;

    const fullCharacter = await AppDataSource.getRepository(Character).findOne({
        where: { id: character.id },
        relations: ["attributes", "proficiencies", "items", "spells", "journal", "journal.subLocations", "relationships", "relationships.quests"],
    });

    if (!fullCharacter) return null;

    // Retorna apenas o essencial para a IA, reduzindo tokens
    return {
        name: fullCharacter.name,
        race: fullCharacter.race,
        characterClass: fullCharacter.characterClass,
        level: fullCharacter.level,
        hp: fullCharacter.attributes.hp,
        ac: fullCharacter.attributes.ac,
        attributes: {
            strength: fullCharacter.attributes.strength,
            dexterity: fullCharacter.attributes.dexterity,
            constitution: fullCharacter.attributes.constitution,
            intelligence: fullCharacter.attributes.intelligence,
            wisdom: fullCharacter.attributes.wisdom,
            charisma: fullCharacter.attributes.charisma,
        },
        proficiencies: fullCharacter.proficiencies.map(p => p.name),
        inventory: fullCharacter.items.map(item => ({ name: item.name, quantity: item.quantity, equipped: item.itemData.equipped })),
        spells: fullCharacter.spells.map(s => s.spellName),
        journal: fullCharacter.journal,
        relationships: fullCharacter.relationships,
        storySoFar: fullCharacter.storySoFar,
        worldState: fullCharacter.worldState,
        factionReputation: fullCharacter.factionReputation,
        conditions: fullCharacter.attributes.conditions,
    };
};

// Salva o estado atualizado do personagem no banco de dados.
const persistCharacterUpdates = async (characterId: number, updates: any) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const characterRepo = queryRunner.manager.getRepository(Character);
        const character = await characterRepo.findOne({ where: { id: characterId }});
        if (!character) throw new Error("Personagem não encontrado para atualização.");

        // Atualiza campos diretos do personagem
        const directFields = ['level', 'xp', 'storySoFar', 'worldState', 'factionReputation', 'currentRegion'];
        for (const field of directFields) {
            if (updates[field] !== undefined) {
                (character as any)[field] = updates[field];
            }
        }
        await characterRepo.save(character);

        // Atualiza atributos (HP, AC, Condições)
        if (updates.attributes) {
            const attrRepo = queryRunner.manager.getRepository(CharacterAttributes);
            await attrRepo.update({ characterId }, updates.attributes);
        }

        // Atualiza o inventário (sobrescrevendo o estado anterior)
        if (updates.inventory) {
            const itemRepo = queryRunner.manager.getRepository(CharacterItem);
            await itemRepo.delete({ characterId }); // Limpa o inventário antigo
            const newItems = updates.inventory.map((itemData: any) => {
                const newItem = new CharacterItem();
                newItem.characterId = characterId;
                newItem.name = itemData.name;
                newItem.quantity = itemData.quantity;
                newItem.itemData = itemData;
                return newItem;
            });
            await itemRepo.save(newItems);
        }
        
        // Atualiza Magias (sobrescrevendo)
        if (updates.spells) {
            const spellRepo = queryRunner.manager.getRepository(CharacterSpell);
            await spellRepo.delete({ characterId });
            const newSpells = updates.spells.map((spellName: string) => {
                const newSpell = new CharacterSpell();
                newSpell.characterId = characterId;
                newSpell.spellName = spellName;
                return newSpell;
            });
            await spellRepo.save(newSpells);
        }

        // ... Lógica para atualizar Journal, Relationships, Quests de forma granular
        // (Por simplicidade, isso pode ser implementado em fases posteriores)

        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
        await queryRunner.release();
    }
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

        // Constrói um objeto de personagem otimizado para a IA
        const optimizedCharacter = await buildOptimizedCharacterForAI(sessao.character);
        if (!optimizedCharacter) {
            return next(createError(404, 'Falha ao carregar os dados completos do personagem.'));
        }
        
        // Otimiza o histórico, enviando apenas o essencial
        const recentLogs = await logRepository.find({
            where: { sessaoId: sessao.id },
            order: { timestamp: 'DESC' },
            take: 10,
        });
        const gameLogSummary = recentLogs.reverse().map(log => {
             return `${log.type === 'action' ? 'Jogador' : 'Mestre'}: ${log.response}`;
        }).join('\n');
        
        const gameMasterFlowInput = {
            character: optimizedCharacter,
            playerAction: playerAction,
            gameLog: gameLogSummary,
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
        
        const playerLog = new SessionLog();
        playerLog.sessao = sessao;
        playerLog.prompt = playerAction;
        playerLog.response = playerAction;
        playerLog.type = 'action';
        await logRepository.save(playerLog);
        
        if (aiResponse.logEntries) {
            for (const entry of aiResponse.logEntries) {
                const newLog = new SessionLog();
                newLog.sessao = sessao;
                newLog.prompt = JSON.stringify(gameMasterFlowInput); // Log do input para debug
                newLog.response = entry.content;
                newLog.type = entry.type;
                newLog.rollResult = entry.rollResult;
                await logRepository.save(newLog);
            }
        }
        
        // Persiste as atualizações do personagem, se houver
        if (aiResponse.updatedCharacter) {
            await persistCharacterUpdates(sessao.character.id, aiResponse.updatedCharacter);
        }
        
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error(`Erro ao processar narração para sessão ${sessionId}:`, error);
        next(error);
    }
};
