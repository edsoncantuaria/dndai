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
import type { GameMasterFlowInput, GameMasterResponse, CombatState } from '../schemas/gameSchemas.js';
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
    
    const proficiencies = Array.isArray(fullCharacter.proficiencies) ? fullCharacter.proficiencies : [];
    const isProficientInPerception = proficiencies.some(p => p?.name?.toLowerCase().includes('perception'));
    const isProficientInInsight = proficiencies.some(p => p?.name?.toLowerCase().includes('insight'));
    const isProficientInInvestigation = proficiencies.some(p => p?.name?.toLowerCase().includes('investigation'));

    const passivePerception = 10 + wisdomMod + (isProficientInPerception ? proficiencyBonus : 0);
    const passiveInsight = 10 + wisdomMod + (isProficientInInsight ? proficiencyBonus : 0);
    const passiveInvestigation = 10 + intelligenceMod + (isProficientInInvestigation ? proficiencyBonus : 0);

    const inventory = Array.isArray(fullCharacter.items) ? fullCharacter.items : [];
    const spells = Array.isArray(fullCharacter.spells) ? fullCharacter.spells : [];

    return {
        id: fullCharacter.id, // Include ID for context
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
        proficiencies: proficiencies.map(p => p?.name).filter(Boolean),
        inventory: inventory.map(item => ({...item.itemData, equipped: item.equipped})),
        spells: spells.map(s => s?.spellName).filter(Boolean),
        feats: fullCharacter.feats || [],
        journal: fullCharacter.journal || [],
        relationships: fullCharacter.relationships || [],
        storySoFar: fullCharacter.storySoFar || "",
        worldState: fullCharacter.worldState || { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Desconhecida' },
        factionReputation: fullCharacter.factionReputation || {},
        currentRegion: fullCharacter.currentRegion || "",
    };
};

const upsertJournalEntries = async (queryRunner: QueryRunner, entries: any[], characterId: number, parent: JournalEntry | null = null): Promise<JournalEntry[]> => {
    const savedEntries: JournalEntry[] = [];
    if (!Array.isArray(entries)) return savedEntries;

    for (const entryData of entries) {
        if (!entryData || typeof entryData !== 'object') continue;
        let entry: JournalEntry | null = null;
        if(entryData.id) {
            entry = await queryRunner.manager.findOne(JournalEntry, { where: { id: entryData.id } });
        }
        
        if (!entry) {
            entry = new JournalEntry();
            entry.id = entryData.id || uuidv4();
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

        if (entryData.subLocations && Array.isArray(entryData.subLocations) && entryData.subLocations.length > 0) {
            await upsertJournalEntries(queryRunner, entryData.subLocations, characterId, savedEntry);
        }
        savedEntries.push(savedEntry);
    }
    return savedEntries;
};


// Persiste as atualizações do personagem no banco de dados de forma inteligente.
const persistCharacterUpdates = async (characterId: number, updates: any, queryRunner: QueryRunner) => {
    const character = await queryRunner.manager.getRepository(Character).findOne({ where: { id: characterId }, relations: ["items", "spells", "journal", "relationships", "relationships.quests"] });
    if (!character) throw new Error("Personagem não encontrado para atualização.");

    // Update direct character fields
    const directFields = ['level', 'xp', 'storySoFar', 'factionReputation', 'worldState', 'currentRegion'];
    directFields.forEach(field => {
        if (updates[field] !== undefined && updates[field] !== null) {
            if (field === 'factionReputation') {
                character.factionReputation = { ...(character.factionReputation || {}), ...updates.factionReputation };
            } else if (field === 'worldState') {
                character.worldState = { ...(character.worldState || {}), ...updates.worldState };
                 if (updates.worldState.currentRegion) {
                    character.currentRegion = updates.worldState.currentRegion;
                }
            } else {
                (character as any)[field] = updates[field];
            }
        }
    });
    await queryRunner.manager.save(character);

    // Update attributes
    if (updates.attributes) {
        await queryRunner.manager.getRepository(CharacterAttributes).update({ characterId }, updates.attributes);
    }

    // Upsert Inventory (optimized)
    if (updates.inventory) {
        const itemsRepo = queryRunner.manager.getRepository(CharacterItem);
        const existingItemsMap = new Map((character.items || []).map(item => [item.itemData.index || item.name, item]));
        
        for (const itemData of updates.inventory) {
            if (!itemData) continue;
            const itemKey = itemData.index || itemData.name;
            const existingItem = existingItemsMap.get(itemKey);

            if (itemData.quantity <= 0) {
                if(existingItem) await itemsRepo.remove(existingItem);
                continue;
            }

            if (existingItem) {
                existingItem.quantity = itemData.quantity;
                existingItem.equipped = itemData.equipped || false;
                await itemsRepo.save(existingItem);
            } else {
                const newItem = itemsRepo.create({ characterId, name: itemData.name, quantity: itemData.quantity, equipped: itemData.equipped || false, itemData });
                await itemsRepo.save(newItem);
            }
        }
    }
    
    // Upsert Spells (optimized)
    if (updates.spells) {
        const spellsRepo = queryRunner.manager.getRepository(CharacterSpell);
        await spellsRepo.delete({ characterId }); // Simple clear and re-add is fine for spells
        const newSpells = updates.spells.map((spellName: string) => spellsRepo.create({ characterId, spellName }));
        if(newSpells.length > 0) await spellsRepo.save(newSpells);
    }

    // Upsert Journal
    if(updates.journal) {
        await upsertJournalEntries(queryRunner, updates.journal, characterId);
    }

    // Upsert Relationships and Quests (with deletion)
    if(updates.relationships && Array.isArray(updates.relationships)) {
        for (const relData of updates.relationships) {
            if (!relData || !relData.npcId) continue;
            let relationship = (character.relationships || []).find(r => r.npcId === relData.npcId);
            if (!relationship) {
                relationship = queryRunner.manager.getRepository(Relationship).create({ npcId: relData.npcId, characterId });
            }
            Object.assign(relationship, { name: relData.name, description: relData.description, status: relData.status, affinity: relData.affinity });
            const savedRel = await queryRunner.manager.save(relationship);
            
            // Sync Quests
            if (relData.quests) {
                const existingQuests = savedRel.quests || [];
                const aiQuestIds = new Set(relData.quests.map((q: any) => q.id).filter(Boolean));
                
                // Delete quests not present in AI response
                const questsToDelete = existingQuests.filter(q => !aiQuestIds.has(q.id));
                if(questsToDelete.length > 0) await queryRunner.manager.remove(questsToDelete);

                // Upsert quests from AI response
                for(const questData of relData.quests) {
                    let quest = existingQuests.find(q => q.id === questData.id);
                    if(!quest) {
                        quest = queryRunner.manager.getRepository(Quest).create({ id: questData.id || uuidv4(), relationshipId: savedRel.id });
                    }
                    Object.assign(quest, { title: questData.title, status: questData.status, objectives: questData.objectives });
                    await queryRunner.manager.save(quest);
                }
            }
        }
    }
};

const sanitizeAndProcessResponse = (response: GameMasterResponse, characterState: any): GameMasterResponse => {
    const sanitized: GameMasterResponse = { ...response };
    const sanitizationLogs: string[] = [];

    // Sanitize logEntries by ensuring they are objects
    if (Array.isArray(sanitized.logEntries)) {
        sanitized.logEntries = sanitized.logEntries.map((entry: any, index) => {
            if (typeof entry === 'string') {
                sanitizationLogs.push(`Sanitized logEntries[${index}]: Converted string to object.`);
                try {
                    const parsed = JSON.parse(entry);
                    if (typeof parsed === 'object' && parsed !== null) return parsed;
                } catch {
                    return { type: "narration", content: entry };
                }
            }
            if (entry === null || typeof entry !== 'object') {
                 sanitizationLogs.push(`Sanitized logEntries[${index}]: Removed invalid/null entry.`);
                return null;
            }
            return entry;
        }).filter(Boolean) as any[];
    } else if (sanitized.logEntries === null || sanitized.logEntries === undefined) {
         sanitized.logEntries = [];
         sanitizationLogs.push("Sanitized logEntries: Was null/undefined, set to [].");
    }

    // Sanitize other optional fields that should be objects or arrays
    const fieldsToSanitize = {
        combatState: {}, worldState: {}, playerRollRequest: null,
        levelUpState: null, shopState: null, lootOffer: null, useHitDiceRequest: null,
        newHomebrewContent: [],
    };

    for (const key in fieldsToSanitize) {
        const field = key as keyof typeof fieldsToSanitize;
        if (sanitized[field] === null || sanitized[field] === undefined) {
            sanitizationLogs.push(`Sanitized ${field}: Was null/undefined, set to default.`);
            sanitized[field] = fieldsToSanitize[field] as any;
        }
    }

    if (sanitizationLogs.length > 0) {
        const existingLog = sanitized.systemLog ? `${sanitized.systemLog}\n` : '';
        sanitized.systemLog = `${existingLog}SANITIZATION: ${sanitizationLogs.join(' ')}`;
    }

    return sanitized;
};


export const processPlayerTurn = async (sessionId: number, userId: number, playerAction: string, apiKey: string, currentCombatState?: CombatState, modelOverride?: string): Promise<GameMasterResponse> => {
    let isTestRun = false;
    let sessao: SessaoIA | null = null;
    let user: User | null = null;
    let characterForAI: any = null;
    let installedHomebrewSummary: any[] = [];

    if (sessionId === -1) {
        isTestRun = true;
        user = await AppDataSource.getRepository(User).findOneBy({ id: userId });
        characterForAI = {
            id: 1, name: 'Herói de Teste', race: 'Humano', characterClass: 'Guerreiro', level: 1,
            attributes: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, hp: 10, ac: 10, conditions: [] },
            proficiencies: [], inventory: [], spells: [], storySoFar: '', worldState: { timeOfDay: 'Manhã', weather: 'Ensolarado' },
            relationships: [], journal: [], factionReputation: {}, currentRegion: 'Plano de Testes',
            passivePerception: 10, passiveInsight: 10, passiveInvestigation: 10,
        };
    } else {
        const sessaoRepository = AppDataSource.getRepository(SessaoIA);
        const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
        const userRepository = AppDataSource.getRepository(User);

        user = await userRepository.findOneBy({ id: userId });
        sessao = await sessaoRepository.findOne({ where: { id: sessionId, userId }, relations: ["character"] });

        if (!sessao || !sessao.character) {
            throw createError(404, 'Sessão de IA ou personagem não encontrado.');
        }

        characterForAI = await buildOptimizedCharacterForAI(sessao.character.id);
        if (!characterForAI) {
            throw createError(500, 'Falha ao carregar os dados completos do personagem para a IA.');
        }
        
        if (sessao.homebrewContentIds && sessao.homebrewContentIds.length > 0) {
            const homebrewItems = await homebrewRepo.find({ where: { id: In(sessao.homebrewContentIds) } });
            installedHomebrewSummary = homebrewItems.map(item => ({ name: item.name, type: item.type }));
        }
    }
    
    if (!apiKey) {
        throw createError(400, 'A chave de API não está configurada para este usuário. Por favor, adicione-a em "Configurações".');
    }
    
    const modelToUse = modelOverride || user?.settings?.model || "gemini-2.5-flash";
    const generationConfig = user?.settings?.generationConfig || {};
    
    const recentLogs = isTestRun ? [] : await AppDataSource.getRepository(SessionLog).find({
        where: { sessaoId: sessao!.id },
        order: { timestamp: 'DESC' }, 
        take: 10,
    });
    
    const chronologicalLogs = recentLogs.reverse().map(log => ({
        role: log.type === 'action' ? 'user' : 'model',
        content: log.response
    }));

    const gameMasterFlowInput: GameMasterFlowInput = {
        character: characterForAI,
        playerAction,
        gameLog: JSON.stringify(chronologicalLogs),
        combatState: currentCombatState,
        installedHomebrew: installedHomebrewSummary,
    };

    let aiResponse = await getGameUpdate(gameMasterFlowInput, modelToUse, generationConfig, apiKey);
    if (!aiResponse) {
        return {
            logEntries: [{ type: 'system', content: 'O Mestre de Jogo está confuso e não conseguiu responder. Por favor, tente sua ação novamente.' }],
            actionOptions: ['Tentar a última ação novamente', 'Fazer algo diferente'],
            worldState: characterForAI.worldState,
        }
    }
    
    aiResponse = sanitizeAndProcessResponse(aiResponse, characterForAI);
    
    if (aiResponse.playerRollRequest) {
        if (aiResponse.systemLog) {
            console.log("[narrarService] System Log para Player Roll Request:", aiResponse.systemLog);
        }
        return { 
            ...aiResponse,
            playerRollRequest: aiResponse.playerRollRequest, 
            actionOptions: aiResponse.actionOptions || [] 
        } as GameMasterResponse;
    }
    
    if (isTestRun || !sessao) {
        return aiResponse;
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const logRepository = queryRunner.manager.getRepository(SessionLog);
        const logsToSave: SessionLog[] = [];

        const isInternalAction = playerAction.startsWith("Recarregar estado atual") || playerAction.startsWith("A aventura começa.") || playerAction.includes("Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades");
        
        if(!isInternalAction) {
            const playerLog = logRepository.create({ sessaoId: sessao.id, prompt: playerAction, response: playerAction, type: 'action' });
            logsToSave.push(playerLog);
        }
        
        // Otimização: Truncar dados pesados antes de salvar o log de estado
        const stateForLog = { ...aiResponse };
        if(stateForLog.updatedCharacter?.inventory) {
             stateForLog.updatedCharacter.inventory = `[${stateForLog.updatedCharacter.inventory.length} items]`;
        }
        if(stateForLog.updatedCharacter?.journal) {
            stateForLog.updatedCharacter.journal = `[${stateForLog.updatedCharacter.journal.length} entries]`;
        }

        const stateLog = logRepository.create({
            sessaoId: sessao.id,
            prompt: 'GM Full State',
            response: JSON.stringify(stateForLog),
            type: 'state',
        });
        logsToSave.push(stateLog);

        if (aiResponse.logEntries) {
            for (const entry of aiResponse.logEntries) {
                 if (entry?.content && typeof entry.content === 'string') {
                    const newLog = logRepository.create({
                        sessaoId: sessao.id,
                        prompt: 'GM Narration',
                        response: entry.content,
                        type: entry.type || 'narration',
                        rollResult: entry.rollResult,
                    });
                    logsToSave.push(newLog);
                }
            }
        }
        if (logsToSave.length > 0) await logRepository.save(logsToSave);


        if (aiResponse.newHomebrewContent) {
            for (const newContent of aiResponse.newHomebrewContent) {
                try {
                    const existing = await HomebrewService.findHomebrewContentByName(newContent.name, newContent.type);
                    if (!existing) {
                        await HomebrewService.createHomebrewContent(userId, newContent);
                    }
                } catch (error) {
                    console.error(`[narrarService] Falha ao salvar conteúdo Homebrew da IA:`, error);
                }
            }
        }

        if (aiResponse.updatedCharacter || aiResponse.worldState) {
            const updates = { ...aiResponse.updatedCharacter, worldState: aiResponse.worldState };
            await persistCharacterUpdates(sessao.character!.id, updates, queryRunner);
        }
        
        await queryRunner.commitTransaction();
        return aiResponse;
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error("Erro na transação de narração:", error);
        throw createError(500, 'Falha ao salvar o progresso da aventura.');
    } finally {
        await queryRunner.release();
    }
};

    