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
import { getGameUpdate } from './aiService.js';
import createError from 'http-errors';
import type { GameMasterFlowInput, GameMasterResponse } from '../schemas/gameSchemas.js';
import { In, QueryRunner } from 'typeorm';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { v4 as uuidv4 } from 'uuid';
import * as HomebrewService from './homebrewService.js';

// Função auxiliar para calcular o modificador de um atributo
const calculateModifier = (score: number) => Math.floor((score - 10) / 2);

// Constrói um objeto de personagem otimizado para a IA.
const buildOptimizedCharacterForAI = async (characterId: number) => {
    const characterRepo = AppDataSource.getRepository(Character);
    const fullCharacter = await characterRepo.findOne({
        where: { id: characterId },
        relations: ["attributes", "proficiencies", "items", "spells", "journal", "journal.subLocations", "relationships", "relationships.quests"],
    });

    if (!fullCharacter || !fullCharacter.attributes) return null;
    
    const proficiencyBonus = Math.floor((fullCharacter.level - 1) / 4) + 2;
    const wisdomMod = calculateModifier(fullCharacter.attributes.wisdom);
    const intelligenceMod = calculateModifier(fullCharacter.attributes.intelligence);
    
    const isProficientInPerception = fullCharacter.proficiencies.some(p => p.name.toLowerCase().includes('perception'));
    const isProficientInInsight = fullCharacter.proficiencies.some(p => p.name.toLowerCase().includes('insight'));
    const isProficientInInvestigation = fullCharacter.proficiencies.some(p => p.name.toLowerCase().includes('investigation'));

    const passivePerception = 10 + wisdomMod + (isProficientInPerception ? proficiencyBonus : 0);
    const passiveInsight = 10 + wisdomMod + (isProficientInInsight ? proficiencyBonus : 0);
    const passiveInvestigation = 10 + intelligenceMod + (isProficientInInvestigation ? proficiencyBonus : 0);

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
        passivePerception,
        passiveInsight,
        passiveInvestigation,
        proficiencies: fullCharacter.proficiencies.map(p => p.name),
        inventory: fullCharacter.items.map(item => ({...item.itemData, equipped: item.equipped})),
        spells: fullCharacter.spells.map(s => s.spellName),
        feats: fullCharacter.feats || [],
        journal: fullCharacter.journal || [],
        relationships: fullCharacter.relationships || [],
        storySoFar: fullCharacter.storySoFar || "",
        worldState: fullCharacter.worldState || { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Desconhecida' },
        factionReputation: fullCharacter.factionReputation || {},
        currentRegion: fullCharacter.currentRegion || "",
    };
};

const upsertJournalEntries = async (queryRunner: QueryRunner, entries: any[], characterId: number, parent: JournalEntry | null = null) => {
    for (const entryData of entries) {
        // Tenta encontrar a entrada por ID, se existir
        let entry: JournalEntry | null = null;
        if(entryData.id) {
            entry = await queryRunner.manager.findOne(JournalEntry, { where: { id: entryData.id } });
        }
        
        // Se não encontrar, cria uma nova
        if (!entry) {
            entry = new JournalEntry();
            entry.id = entryData.id || uuidv4(); // Usa o ID da IA ou gera um novo
            entry.characterId = characterId;
        }
        
        Object.assign(entry, {
            name: entryData.name,
            region: entryData.region,
            summary: entryData.summary,
            looted: entryData.looted,
            parentLocation: parent,
        });
        
        const savedEntry = await queryRunner.manager.save(entry);

        if (entryData.subLocations && entryData.subLocations.length > 0) {
            await upsertJournalEntries(queryRunner, entryData.subLocations, characterId, savedEntry);
        }
    }
};


// Persiste as atualizações do personagem no banco de dados de forma inteligente.
const persistCharacterUpdates = async (characterId: number, updates: any) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const character = await queryRunner.manager.getRepository(Character).findOne({ where: { id: characterId }});
        if (!character) throw new Error("Personagem não encontrado para atualização.");

        const directFields = ['level', 'xp', 'storySoFar', 'factionReputation'];
        directFields.forEach(field => {
            if (updates[field] !== undefined) {
                if (field === 'factionReputation' && updates[field]) {
                    // Merge faction reputation instead of overwriting
                    character.factionReputation = { ...(character.factionReputation || {}), ...updates.factionReputation };
                } else {
                    (character as any)[field] = updates[field];
                }
            }
        });
        
        // Handle worldState separately to merge properties
        if (updates.worldState) {
            character.worldState = { ...(character.worldState || {}), ...updates.worldState };
            // Specifically update currentRegion if it's part of the worldState update
            if (updates.worldState.currentRegion) {
                character.currentRegion = updates.worldState.currentRegion;
            }
        }


        await queryRunner.manager.save(character);

        if (updates.attributes) {
            await queryRunner.manager.getRepository(CharacterAttributes).update({ characterId }, updates.attributes);
        }
        if (updates.inventory) {
             const itemsRepo = queryRunner.manager.getRepository(CharacterItem);
             await itemsRepo.delete({ characterId }); 
             const newItems = updates.inventory.map((itemData: any) => {
                 const newItem = new CharacterItem();
                 Object.assign(newItem, { 
                     characterId, 
                     name: itemData.name, 
                     quantity: itemData.quantity,
                     equipped: itemData.equipped || false,
                     itemData 
                 });
                 return newItem;
             });
             await itemsRepo.save(newItems);
        }
        if (updates.spells) {
            const spellsRepo = queryRunner.manager.getRepository(CharacterSpell);
            await spellsRepo.delete({ characterId });
            const newSpells = updates.spells.map((spellName: string) => {
                const newSpell = new CharacterSpell();
                Object.assign(newSpell, { characterId, spellName });
                return newSpell;
            });
            await spellsRepo.save(newSpells);
        }
        if(updates.journal) {
            await upsertJournalEntries(queryRunner, updates.journal, characterId);
        }
        if(updates.relationships) {
            for (const relData of updates.relationships) {
                let relationship = await queryRunner.manager.findOne(Relationship, { where: { npcId: relData.npcId, characterId }});
                if (!relationship) {
                    relationship = new Relationship();
                    relationship.npcId = relData.npcId;
                    relationship.characterId = characterId;
                }
                Object.assign(relationship, {
                    name: relData.name,
                    description: relData.description,
                    status: relData.status,
                    affinity: relData.affinity,
                });
                const savedRel = await queryRunner.manager.save(relationship);
                
                if (relData.quests) {
                    for(const questData of relData.quests) {
                        let quest = await queryRunner.manager.findOne(Quest, { where: { id: questData.id }});
                        if (!quest) {
                            quest = new Quest();
                            quest.id = questData.id || uuidv4();
                            quest.relationshipId = savedRel.id;
                        }
                        Object.assign(quest, {
                            title: questData.title,
                            status: questData.status,
                            objectives: questData.objectives,
                        });
                        await queryRunner.manager.save(quest);
                    }
                }
            }
        }
        
        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error("Erro ao persistir atualizações do personagem:", error);
        throw createError(500, 'Falha ao salvar atualizações do personagem.');
    } finally {
        await queryRunner.release();
    }
};

/**
 * Sanitizes the logEntries from the AI response to ensure they are in a consistent format.
 * @param entries The raw logEntries array from the AI.
 * @returns A cleaned array of log entry objects.
 */
const sanitizeLogEntries = (entries: any): any[] => {
    if (!Array.isArray(entries)) {
        // If it's not an array, wrap it in one for consistent processing
        entries = [entries];
    }

    const sanitized: any[] = [];

    for (let entry of entries) {
        if (!entry) continue;

        if (typeof entry === 'string') {
            try {
                // Try to parse if it's a JSON string
                entry = JSON.parse(entry);
            } catch (e) {
                // If it's just a plain string, treat it as narration content
                entry = { type: 'narration', content: entry };
            }
        }

        // Ensure it's a valid object with at least type and content
        if (typeof entry === 'object' && entry.type && entry.content) {
            // Remove any HTML tags from the content
            if (typeof entry.content === 'string') {
                entry.content = entry.content.replace(/<[^>]*>?/gm, '');
            }
            sanitized.push(entry);
        }
    }
    return sanitized;
};


export const processPlayerTurn = async (sessionId: number, userId: number, playerAction: string, apiKey: string, currentCombatState?: any): Promise<GameMasterResponse> => {
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);
    const logRepository = AppDataSource.getRepository(SessionLog);
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const userRepository = AppDataSource.getRepository(User);

    const user = await userRepository.findOneBy({ id: userId });
    const sessao = await sessaoRepository.findOne({ where: { id: sessionId, userId }, relations: ["character"] });
    if (!sessao || !sessao.character) {
        throw createError(404, 'Sessão de IA ou personagem não encontrado.');
    }
    
    if (!apiKey) {
        throw createError(400, 'A chave de API não está configurada para este usuário. Por favor, adicione-a em "Configurações".');
    }
    
    const modelToUse = user?.settings?.model || "gemini-2.5-flash";
    const generationConfig = user?.settings?.generationConfig || {};


    const optimizedCharacter = await buildOptimizedCharacterForAI(sessao.character.id);
    if (!optimizedCharacter) {
        throw createError(500, 'Falha ao carregar os dados completos do personagem para a IA.');
    }

    let installedHomebrew: any[] = [];
    if (sessao.homebrewContentIds && sessao.homebrewContentIds.length > 0) {
        const homebrewItems = await homebrewRepo.find({ where: { id: In(sessao.homebrewContentIds) } });
        installedHomebrew = homebrewItems.map(item => item.content);
    }

    const recentLogs = await logRepository.find({
        where: { sessaoId: sessao.id },
        order: { timestamp: 'DESC' }, 
        take: 10,
    });
    
    const chronologicalLogs = recentLogs.reverse().map(log => ({
        role: log.type === 'action' ? 'user' : 'model',
        content: log.response
    }));

    const gameMasterFlowInput: GameMasterFlowInput = {
        character: optimizedCharacter as any,
        playerAction,
        gameLog: JSON.stringify(chronologicalLogs),
        combatState: currentCombatState,
        installedHomebrew: installedHomebrew,
    };

    const aiResponse = await getGameUpdate(gameMasterFlowInput, modelToUse, generationConfig, apiKey);
    if (!aiResponse) {
        throw createError(500, 'O Mestre de Jogo não conseguiu formular uma resposta.');
    }
    
    // --- Início da Seção de Saneamento ---
    
    // 1. Sanitize logEntries
    aiResponse.logEntries = sanitizeLogEntries(aiResponse.logEntries);
    
    // 2. Ensure worldState is always an object, falling back to the character's current state
    if (!aiResponse.worldState) {
        aiResponse.worldState = optimizedCharacter.worldState;
    }

    // 3. If a player roll is requested, return it immediately with its specific actionOptions.
    // This is the highest priority response to ensure no rolls are missed.
    if (aiResponse.playerRollRequest) {
        if (aiResponse.systemLog) {
            const systemLog = new SessionLog();
            Object.assign(systemLog, { sessaoId: sessao.id, prompt: 'Player Roll Request', response: aiResponse.systemLog, type: 'system' });
            await logRepository.save(systemLog);
        }
        return { 
            playerRollRequest: aiResponse.playerRollRequest, 
            actionOptions: aiResponse.actionOptions || [] 
        } as GameMasterResponse;
    }

    // -- Fim da Seção de Saneamento --

    // Log player action, unless it's a system reload
    if(playerAction !== "Recarregar estado atual e obter opções.") {
        const playerLog = new SessionLog();
        Object.assign(playerLog, { sessaoId: sessao.id, prompt: playerAction, response: playerAction, type: 'action' });
        await logRepository.save(playerLog);
    }
    
    // Salva a resposta completa como um log de estado especial
    const stateLog = new SessionLog();
    Object.assign(stateLog, {
        sessaoId: sessao.id,
        prompt: 'GM Full State',
        response: JSON.stringify(aiResponse), // Save the entire sanitized response
        type: 'state',
    });
    await logRepository.save(stateLog);

    // Save the cleaned narration logs for display
    if (aiResponse.logEntries) {
        for (const entry of aiResponse.logEntries) {
             if (entry.content) { // Ensure there's content to save
                const newLog = new SessionLog();
                Object.assign(newLog, {
                    sessaoId: sessao.id,
                    prompt: 'GM Narration',
                    response: entry.content, // Save only the string content
                    type: entry.type || 'narration',
                    rollResult: entry.rollResult,
                });
                await logRepository.save(newLog);
            }
        }
    }

    // Persist new homebrew content created by the AI
    if (aiResponse.newHomebrewContent) {
        for (const newContent of aiResponse.newHomebrewContent) {
            try {
                // Check if content with this name and type already exists to prevent duplicates
                const existing = await HomebrewService.findHomebrewContentByName(newContent.name, newContent.type);
                if (!existing) {
                    await HomebrewService.createHomebrewContent(userId, newContent);
                    console.log(`[narrarService] Conteúdo Homebrew da IA salvo: ${newContent.name}`);
                } else {
                    console.log(`[narrarService] Conteúdo Homebrew da IA já existe, não foi salvo novamente: ${newContent.name}`);
                }
            } catch (error) {
                console.error(`[narrarService] Falha ao salvar conteúdo Homebrew da IA:`, error);
            }
        }
    }

    if (aiResponse.updatedCharacter) {
        await persistCharacterUpdates(sessao.character.id, aiResponse.updatedCharacter);
    }
    
    return aiResponse;
};
