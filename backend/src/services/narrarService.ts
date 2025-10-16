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
import { GameMasterResponseSchema } from '../schemas/gameSchemas.js';
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

    const inventory = Array.isArray(fullCharacter.items) ? fullCharacter.items.map(item => ({...item.itemData, equipped: item.equipped})) : [];
    const spells = Array.isArray(fullCharacter.spells) ? fullCharacter.spells.map(s => s?.spellName).filter(Boolean) : [];

    return {
        id: fullCharacter.id,
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
        inventory,
        spells,
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

const persistCharacterUpdates = async (characterId: number, updates: any, queryRunner: QueryRunner) => {
    const characterRepo = queryRunner.manager.getRepository(Character);
    const character = await characterRepo.findOne({ where: { id: characterId }, relations: ["items", "spells", "journal", "relationships", "relationships.quests"] });
    if (!character) throw new Error("Personagem não encontrado para atualização.");

    // Update direct character fields
    const directFields = ['level', 'xp', 'storySoFar', 'factionReputation', 'worldState', 'currentRegion'];
    directFields.forEach(field => {
        if (updates[field] !== undefined) {
            if (field === 'factionReputation' && typeof updates.factionReputation === 'object') {
                character.factionReputation = { ...(character.factionReputation || {}), ...updates.factionReputation };
            } else if (field === 'worldState' && typeof updates.worldState === 'object') {
                character.worldState = { ...(character.worldState || {}), ...updates.worldState };
                if (updates.worldState.currentRegion) {
                    character.currentRegion = updates.worldState.currentRegion;
                }
            } else {
                (character as any)[field] = updates[field];
            }
        }
    });
    await characterRepo.save(character);

    // Update attributes
    if (updates.attributes && typeof updates.attributes === 'object') {
        await queryRunner.manager.getRepository(CharacterAttributes).update({ characterId }, updates.attributes);
    }

    if (updates.inventory && Array.isArray(updates.inventory)) {
        const itemsRepo = queryRunner.manager.getRepository(CharacterItem);
        const existingItemsMap = new Map((character.items || []).map(item => [item.itemData?.index || item.name, item]));
        const updatedItemKeys = new Set<string>();

        for (const itemData of updates.inventory) {
            if (!itemData || (!itemData.index && !itemData.name)) continue;
            const itemKey = itemData.index || itemData.name;
            updatedItemKeys.add(itemKey);
            const existingItem = existingItemsMap.get(itemKey);

            if (itemData.quantity <= 0) {
                if (existingItem) await itemsRepo.remove(existingItem);
                continue;
            }

            if (existingItem) {
                if (existingItem.quantity !== itemData.quantity || existingItem.equipped !== (itemData.equipped || false)) {
                    existingItem.quantity = itemData.quantity;
                    existingItem.equipped = itemData.equipped || false;
                    await itemsRepo.save(existingItem);
                }
            } else {
                const newItem = itemsRepo.create({
                    characterId,
                    name: itemData.name,
                    quantity: itemData.quantity,
                    equipped: itemData.equipped || false,
                    itemData
                });
                await itemsRepo.save(newItem);
            }
        }
        
        for (const [key, item] of existingItemsMap.entries()) {
            if (!updatedItemKeys.has(key)) {
                await itemsRepo.remove(item);
            }
        }
    }
    
    if (updates.spells && Array.isArray(updates.spells)) {
        const spellsRepo = queryRunner.manager.getRepository(CharacterSpell);
        const existingSpells = new Set((character.spells || []).map(s => s.spellName));
        const newSpellsSet = new Set(updates.spells);
        const spellsToAdd = updates.spells.filter((s: string) => !existingSpells.has(s));
        const spellsToRemove = (character.spells || []).filter(s => !newSpellsSet.has(s.spellName));

        if (spellsToRemove.length > 0) await spellsRepo.remove(spellsToRemove);
        if (spellsToAdd.length > 0) {
            const spellEntities = spellsToAdd.map((spellName: string) => spellsRepo.create({ characterId, spellName }));
            await spellsRepo.save(spellEntities);
        }
    }

    if(updates.journal) {
        await upsertJournalEntries(queryRunner, updates.journal, characterId);
    }
    
    if (updates.relationships && Array.isArray(updates.relationships)) {
        const relationshipRepo = queryRunner.manager.getRepository(Relationship);
        const questRepo = queryRunner.manager.getRepository(Quest);
        const aiRelIds = new Set(updates.relationships.map((r: any) => r.npcId).filter(Boolean));

        // Delete relationships not present in the AI response
        for (const existingRel of (character.relationships || [])) {
            if (!aiRelIds.has(existingRel.npcId)) {
                await relationshipRepo.remove(existingRel);
            }
        }

        for (const relData of updates.relationships) {
            if (!relData || !relData.npcId) continue;
            let relationship = (character.relationships || []).find(r => r.npcId === relData.npcId);
            if (!relationship) {
                relationship = relationshipRepo.create({ npcId: relData.npcId, characterId });
            }
            Object.assign(relationship, { name: relData.name, description: relData.description, status: relData.status, affinity: relData.affinity });
            const savedRel = await relationshipRepo.save(relationship);
            
            const aiQuestIds = new Set((relData.quests || []).map((q: any) => q.id).filter(Boolean));
            const existingQuests = savedRel.quests || [];
            
            // Delete quests not present in the AI response for this relationship
            for(const quest of existingQuests){
                if(!aiQuestIds.has(quest.id)){
                     await questRepo.remove(quest);
                }
            }
            
            // Upsert quests
            if (relData.quests && Array.isArray(relData.quests)) {
                for (const questData of relData.quests) {
                    if (!questData || !questData.title) continue;
                    let quest = existingQuests.find(q => q.id === questData.id);
                    if (!quest) {
                        quest = questRepo.create({ id: questData.id || uuidv4(), relationshipId: savedRel.id });
                    }
                    Object.assign(quest, { title: questData.title, status: questData.status, objectives: questData.objectives });
                    await questRepo.save(quest);
                }
            }
        }
    }
};

/**
 * Sanitiza e processa a resposta da IA para garantir que esteja
 * de acordo com o schema do GameMasterResponse, aplicando defaults,
 * convertendo strings JSON e filtrando campos inválidos.
 * @param response Dados brutos vindos da IA
 * @returns GameMasterResponse validado e seguro
 */
export const sanitizeAndProcessResponse = (
  response: any,
  characterState: any
): GameMasterResponse => {
  const sanitizationLogs: string[] = [];
  const copyResponse = { ...response };

  // Parse campos que podem vir como string JSON
  (['combatState', 'worldState'] as const).forEach((key) => {
    if (typeof copyResponse[key] === 'string') {
      try {
        copyResponse[key] = JSON.parse(copyResponse[key]);
        sanitizationLogs.push(`Parsed ${key} from string.`);
      } catch {
        copyResponse[key] = null;
        sanitizationLogs.push(`Failed to parse ${key}, set to null.`);
      }
    }
  });

  // Merge com characterState para garantir campos essenciais
  if (copyResponse.worldState === null || typeof copyResponse.worldState !== 'object') {
    copyResponse.worldState = characterState?.worldState || {
      timeOfDay: 'Manhã',
      weather: 'Ensolarado',
      currentRegion: characterState?.currentRegion || 'Desconhecida',
    };
    sanitizationLogs.push('worldState fallback applied.');
  } else {
    copyResponse.worldState = {
        ...(characterState?.worldState || {}),
        timeOfDay: 'Manhã', weather: 'Ensolarado',
        ...copyResponse.worldState,
        currentRegion: copyResponse.worldState.currentRegion || characterState?.currentRegion || 'Desconhecida',
    }
  }

  if (copyResponse.combatState === null || typeof copyResponse.combatState !== 'object') {
    copyResponse.combatState = null; // Zod schema allows null
  } else {
     copyResponse.combatState = {
        isActive: false, round: 1, turn: 0, combatants: [], initiativeOrder: [],
        ...copyResponse.combatState
     }
  }

  // Garante que arrays existam
  if (!Array.isArray(copyResponse.actionOptions)) {
    copyResponse.actionOptions = ['Tentar novamente', 'Descrever uma ação diferente'];
    sanitizationLogs.push('actionOptions fallback applied.');
  } else {
    copyResponse.actionOptions = copyResponse.actionOptions.filter(Boolean);
    if (copyResponse.actionOptions.length === 0 && !copyResponse.playerRollRequest) {
      copyResponse.actionOptions = ['Tentar novamente', 'Descrever uma ação diferente'];
      sanitizationLogs.push('actionOptions was empty, fallback applied.');
    }
  }

  if (!Array.isArray(copyResponse.newHomebrewContent)) {
    copyResponse.newHomebrewContent = [];
  }

  // Parse logEntries válidas
  if (Array.isArray(copyResponse.logEntries)) {
    copyResponse.logEntries = copyResponse.logEntries
      .map((entry: any) => {
        if (entry && typeof entry === 'object' && entry.type && entry.content) return entry;
        if(typeof entry === 'string') return { type: 'narration', content: entry };
        return null;
      })
      .filter(Boolean);
  } else {
    copyResponse.logEntries = [];
  }

  // Usa Zod para validar e aplicar defaults finais
  const parsed = GameMasterResponseSchema.safeParse(copyResponse);

  if (!parsed.success) {
    console.warn('[sanitizeAndProcessResponse] Validation errors:', parsed.error.format());
    // Retorna fallback mínimo caso a IA tenha retornado algo completamente inválido
    return GameMasterResponseSchema.parse({
      logEntries: [{ type: 'system', content: 'O Mestre de Jogo não conseguiu gerar uma resposta válida.' }],
      actionOptions: ['Tentar novamente', 'Descrever uma ação diferente'],
      worldState: characterState?.worldState,
    });
  }

  if (sanitizationLogs.length > 0) {
    const existingLog = parsed.data.systemLog ? `${parsed.data.systemLog}\n` : '';
    parsed.data.systemLog = `${existingLog}SANITIZATION: ${sanitizationLogs.join(' ')}`;
    console.warn('[sanitizeAndProcessResponse] Sanitization applied:', sanitizationLogs);
  }

  return parsed.data;
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
            proficiencies: [], inventory: [], spells: [], storySoFar: '', worldState: { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Plano de Testes' },
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
            logEntries: [{ type: 'system', content: 'O Mestre de Jogo está confuso e não conseguiu formular uma resposta. Tente sua ação novamente ou com outras palavras.' }],
            actionOptions: ['Tentar a última ação novamente', 'Descrever uma ação diferente'],
            worldState: characterForAI.worldState,
        } as GameMasterResponse;
    }
    
    aiResponse = sanitizeAndProcessResponse(aiResponse, characterForAI);
    
    if (aiResponse.playerRollRequest) {
        return aiResponse;
    }
    
    if (isTestRun || !sessao) {
        return aiResponse;
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const logRepository = queryRunner.manager.getRepository(SessionLog);
        const logsToSave: Partial<SessionLog>[] = [];

        const isInternalAction = playerAction.startsWith("Recarregar estado atual") || playerAction.startsWith("A aventura começa.") || playerAction.includes("Gere uma resposta de Mestre de Jogo que demonstre todas as suas capacidades");
        
        if(!isInternalAction) {
            logsToSave.push({ sessaoId: sessao.id, prompt: playerAction, response: playerAction, type: 'action' });
        }
        
        // Otimização: Não salvar campos grandes e voláteis no log de estado.
        const stateForLog: Partial<GameMasterResponse> = { ...aiResponse };
        delete stateForLog.logEntries;
        delete stateForLog.actionOptions;
        if(stateForLog.updatedCharacter?.inventory) delete stateForLog.updatedCharacter.inventory;
        if(stateForLog.updatedCharacter?.journal) delete stateForLog.updatedCharacter.journal;

        
        logsToSave.push({
            sessaoId: sessao.id,
            prompt: 'GM Full State',
            response: JSON.stringify(stateForLog),
            type: 'state',
        });

        if (aiResponse.logEntries) {
            for (const entry of aiResponse.logEntries) {
                 if (entry?.content && typeof entry.content === 'string') {
                    logsToSave.push({
                        sessaoId: sessao.id,
                        prompt: 'GM Narration',
                        response: entry.content,
                        type: entry.type || 'narration',
                        rollResult: entry.rollResult,
                    });
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

        const updatesToPersist = { ...aiResponse.updatedCharacter, worldState: aiResponse.worldState };
        if (Object.keys(updatesToPersist).length > 1 || updatesToPersist.worldState) { 
            await persistCharacterUpdates(sessao.character!.id, updatesToPersist, queryRunner);
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
