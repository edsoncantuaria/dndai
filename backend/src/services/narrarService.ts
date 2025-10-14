// backend/src/services/narrarService.ts
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import { User } from '../entities/User.js';
import { Character } from '../entities/Character.js';
import { CharacterAttributes } from '../entities/CharacterAttributes.js';
import { CharacterItem } from '../entities/CharacterItem.js';
import { CharacterProficiency } from '../entities/CharacterProficiency.js';
import { CharacterSpell } from '../entities/CharacterSpell.js';
import { JournalEntry } from '../entities/JournalEntry.js';
import { Quest } from '../entities/Quest.js';
import { Relationship } from '../entities/Relationship.js';
import { runGameMasterTurn } from './aiService.js';
import createError from 'http-errors';
import type { GameMasterFlowInput } from '../schemas/gameSchemas.js';

// Constrói um objeto de personagem otimizado para a IA.
const buildOptimizedCharacterForAI = async (characterId: number) => {
    const characterRepo = AppDataSource.getRepository(Character);
    const fullCharacter = await characterRepo.findOne({
        where: { id: characterId },
        relations: ["attributes", "proficiencies", "items", "spells", "journal", "relationships", "relationships.quests"],
    });

    if (!fullCharacter) return null;

    return {
        name: fullCharacter.name,
        race: fullCharacter.race,
        characterClass: fullCharacter.characterClass,
        level: fullCharacter.level,
        attributes: {
            strength: fullCharacter.attributes.strength,
            dexterity: fullCharacter.attributes.dexterity,
            constitution: fullCharacter.attributes.constitution,
            intelligence: fullCharacter.attributes.intelligence,
            wisdom: fullCharacter.attributes.wisdom,
            charisma: fullCharacter.attributes.charisma,
            hp: fullCharacter.attributes.hp,
            ac: fullCharacter.attributes.ac,
            conditions: fullCharacter.attributes.conditions || [],
        },
        proficiencies: fullCharacter.proficiencies.map(p => p.name),
        inventory: fullCharacter.items.map(item => item.itemData),
        spells: fullCharacter.spells.map(s => s.spellName),
        journal: fullCharacter.journal,
        relationships: fullCharacter.relationships,
        storySoFar: fullCharacter.storySoFar,
        worldState: fullCharacter.worldState,
        factionReputation: fullCharacter.factionReputation,
    };
};

// Persiste as atualizações do personagem no banco de dados.
const persistCharacterUpdates = async (characterId: number, updates: any) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const character = await queryRunner.manager.getRepository(Character).findOne({ where: { id: characterId }});
        if (!character) throw new Error("Character not found for update.");

        const directFields = ['level', 'xp', 'storySoFar', 'worldState', 'factionReputation'];
        directFields.forEach(field => {
            if (updates[field] !== undefined) (character as any)[field] = updates[field];
        });
        await queryRunner.manager.save(character);

        if (updates.attributes) {
            await queryRunner.manager.getRepository(CharacterAttributes).update({ characterId }, updates.attributes);
        }
        if (updates.inventory) {
            await queryRunner.manager.getRepository(CharacterItem).delete({ characterId });
            const newItems = updates.inventory.map((itemData: any) => {
                const newItem = new CharacterItem();
                Object.assign(newItem, { characterId, name: itemData.name, quantity: itemData.quantity, itemData });
                return newItem;
            });
            await queryRunner.manager.save(newItems);
        }
        if (updates.spells) {
            await queryRunner.manager.getRepository(CharacterSpell).delete({ characterId });
            const newSpells = updates.spells.map((spellName: string) => {
                const newSpell = new CharacterSpell();
                Object.assign(newSpell, { characterId, spellName });
                return newSpell;
            });
            await queryRunner.manager.save(newSpells);
        }
        if(updates.journal) {
            await queryRunner.manager.getRepository(JournalEntry).delete({ characterId });
            const newJournalEntries = updates.journal.map((entryData: any) => {
                const newEntry = new JournalEntry();
                Object.assign(newEntry, entryData, { characterId });
                return newEntry;
            });
            await queryRunner.manager.save(newJournalEntries);
        }
        if(updates.relationships) {
            await queryRunner.manager.getRepository(Relationship).delete({ characterId });
            for (const relData of updates.relationships) {
                const newRel = new Relationship();
                Object.assign(newRel, relData, { characterId });
                delete (newRel as any).quests;
                const savedRel = await queryRunner.manager.save(newRel);
                
                if (relData.quests) {
                    const newQuests = relData.quests.map((questData: any) => {
                        const newQuest = new Quest();
                        Object.assign(newQuest, questData, { relationshipId: savedRel.id });
                        return newQuest;
                    });
                    await queryRunner.manager.save(newQuests);
                }
            }
        }
        
        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error("Error persisting character updates:", error);
        throw createError(500, 'Falha ao salvar atualizações do personagem.');
    } finally {
        await queryRunner.release();
    }
};

export const processPlayerTurn = async (sessionId: number, userId: number, playerAction: string, currentCombatState?: any) => {
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const logRepository = AppDataSource.getRepository(SessionLog);
    const userRepository = AppDataSource.getRepository(User);

    const sessao = await sessaoRepository.findOne({ where: { id: sessionId, userId }, relations: ["character"] });
    if (!sessao || !sessao.character) {
        throw createError(404, 'Sessão de IA ou personagem não encontrado.');
    }

    const user = await userRepository.findOneBy({ id: userId });
    const apiKey = sessao.apiKey || user?.settings?.apiKey;
    if (!apiKey) {
        throw createError(400, 'A chave de API não está configurada para este usuário.');
    }

    const optimizedCharacter = await buildOptimizedCharacterForAI(sessao.character.id);
    if (!optimizedCharacter) {
        throw createError(500, 'Falha ao carregar os dados completos do personagem para a IA.');
    }

    const recentLogs = await logRepository.find({
        where: { sessaoId: sessao.id },
        order: { timestamp: 'DESC' },
        take: 10,
    });
    const gameLogSummary = recentLogs.reverse().map(log => `${log.type === 'action' ? 'Jogador' : 'Mestre'}: ${log.response}`).join('\n');

    const gameMasterFlowInput: GameMasterFlowInput = {
        character: optimizedCharacter,
        playerAction,
        gameLog: gameLogSummary,
        combatState: currentCombatState,
    };

    const aiResponse = await runGameMasterTurn(gameMasterFlowInput, apiKey, user?.settings?.model || "gemini-1.5-flash");
    if (!aiResponse) {
        throw createError(500, 'O Mestre de Jogo não conseguiu formular uma resposta.');
    }

    // Log player action
    const playerLog = new SessionLog();
    Object.assign(playerLog, { sessaoId: sessao.id, prompt: playerAction, response: playerAction, type: 'action' });
    await logRepository.save(playerLog);

    // Log AI response
    if (aiResponse.logEntries) {
        for (const entry of aiResponse.logEntries) {
            const newLog = new SessionLog();
            Object.assign(newLog, {
                sessaoId: sessao.id,
                prompt: JSON.stringify(gameMasterFlowInput), // For debug
                response: entry.content,
                type: entry.type,
                rollResult: entry.rollResult,
            });
            await logRepository.save(newLog);
        }
    }

    // Persist character updates from AI
    if (aiResponse.updatedCharacter) {
        await persistCharacterUpdates(sessao.character.id, aiResponse.updatedCharacter);
    }
    
    return aiResponse;
};