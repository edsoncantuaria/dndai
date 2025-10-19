// backend/src/services/safeMerge.ts
import { In, QueryRunner } from 'typeorm';
import { Character } from '../entities/Character.js';
import { CharacterAttributes } from '../entities/CharacterAttributes.js';
import { CharacterItem } from '../entities/CharacterItem.js';
import { CharacterSpell } from '../entities/CharacterSpell.js';
import { Relationship } from '../entities/Relationship.js';
import { Quest } from '../entities/Quest.js';
import { JournalEntry } from '../entities/JournalEntry.js';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../database/redis-client.js';

// Função auxiliar para limpar arrays de null/undefined
const sanitizeArray = <T>(arr?: T[]): T[] => Array.isArray(arr) ? arr.filter(Boolean) : [];

// Função recursiva para inserir ou atualizar entradas de diário e suas sub-localizações
const upsertJournalEntries = async (
  queryRunner: QueryRunner,
  entries: any[],
  characterId: number,
  parent: JournalEntry | null = null
): Promise<void> => {
    for (const entryData of sanitizeArray(entries)) {
        if (!entryData || typeof entryData !== 'object' || !entryData.name) continue;

        let entry: JournalEntry | null = null;
        if (entryData.id) {
            entry = await queryRunner.manager.findOne(JournalEntry, { where: { id: entryData.id, characterId } });
        }
        
        if (!entry) {
            entry = queryRunner.manager.create(JournalEntry, { id: entryData.id || uuidv4(), characterId });
        }

        Object.assign(entry, {
            name: entryData.name,
            region: entryData.region,
            summary: entryData.summary,
            looted: entryData.looted,
            parentLocation: parent,
        });

        const saved = await queryRunner.manager.save(entry);

        if (entryData.subLocations) {
            await upsertJournalEntries(queryRunner, entryData.subLocations, characterId, saved);
        }
    }
};

/**
 * Realiza um "merge" inteligente e seguro das atualizações da IA no estado do personagem no banco de dados.
 * Em vez de substituir, ele mescla os dados, garantindo que o progresso histórico não seja perdido.
 * @param characterId O ID do personagem a ser atualizado.
 * @param updates O objeto de atualizações vindo da IA.
 * @param queryRunner O QueryRunner da transação atual do TypeORM.
 */
export const mergeCharacterUpdates = async (
  characterId: number,
  updates: any,
  queryRunner: QueryRunner
) => {
  const characterRepo = queryRunner.manager.getRepository(Character);
  const character = await characterRepo.findOne({
    where: { id: characterId },
    relations: [
      'attributes', // Carrega a relação de atributos
      'items',
      'spells',
      'journal',
      'journal.subLocations',
      'relationships',
      'relationships.quests'
    ],
  });

  if (!character) throw new Error('Personagem não encontrado para o merge.');

  // --- Invalidação de Cache ---
  const cacheKeysToInvalidate = [
      `character:${characterId}`,
      `character:${characterId}:optimized`,
      `session:${character.sessoes?.[0]?.id}:homebrew_summary` // Invalida o resumo da sessão também
  ];
  if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.del(cacheKeysToInvalidate);
        console.log(`[Cache] INVALIDATED: Caches para personagem ${characterId} foram invalidados devido à atualização.`);
      } catch (cacheError) {
        console.error(`[Cache] Erro ao invalidar cache para personagem ${characterId}:`, cacheError);
      }
  }


  // --- Campos diretos e objetos para merge ---
  const directFields = ['level', 'xp', 'storySoFar'];
  directFields.forEach(field => {
    if (updates[field] !== undefined) {
      (character as any)[field] = updates[field];
    }
  });

  if (updates.factionReputation && typeof updates.factionReputation === 'object') {
    character.factionReputation = { ...(character.factionReputation || {}), ...updates.factionReputation };
  }
  if (updates.worldState && typeof updates.worldState === 'object') {
    character.worldState = { ...(character.worldState || {}), ...updates.worldState };
    if (updates.worldState.currentRegion) character.currentRegion = updates.worldState.currentRegion;
  }
  await characterRepo.save(character);

  // --- Attributes (Update direto) ---
  if (updates.attributes && typeof updates.attributes === 'object') {
    const validAttributeUpdates: Partial<CharacterAttributes> = {};
    const attributeKeys: (keyof CharacterAttributes)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'hp', 'ac'];
    
    for (const key of attributeKeys) {
        if (updates.attributes[key] !== undefined) {
            (validAttributeUpdates as any)[key] = updates.attributes[key];
        }
    }
    
    if (Object.keys(validAttributeUpdates).length > 0) {
      await queryRunner.manager.getRepository(CharacterAttributes).update({ characterId }, validAttributeUpdates);
    }
  }

  // --- Inventory (Merge item por item) ---
  if (updates.inventory && Array.isArray(updates.inventory)) {
    const itemsRepo = queryRunner.manager.getRepository(CharacterItem);
    const existingItemsMap = new Map((character.items || []).map(i => [i.itemData?.index || i.name, i]));
    const updatedItemKeys = new Set<string>();

    for (const item of sanitizeArray(updates.inventory)) {
      if(!item.name && !item.index) continue;
      const key = item.index || item.name;
      updatedItemKeys.add(key);
      const existing = existingItemsMap.get(key);
      const quantity = item.quantity === undefined ? 1 : item.quantity;
      
      if (quantity <= 0) {
        if (existing) await itemsRepo.remove(existing);
        continue;
      }
      if (existing) {
        existing.quantity = quantity;
        existing.equipped = item.equipped || false;
        existing.itemData = item; // Atualiza os dados completos
        await itemsRepo.save(existing);
      } else {
        const newItem = itemsRepo.create({ characterId, name: item.name, quantity: quantity, equipped: item.equipped || false, itemData: item });
        await itemsRepo.save(newItem);
      }
    }

    for (const [key, item] of existingItemsMap.entries()) {
      if (!updatedItemKeys.has(key)) await itemsRepo.remove(item);
    }
  }

  // --- Spells (Adiciona/Remove baseado na lista) ---
    if (updates.spells && Array.isArray(updates.spells)) {
    const spellsRepo = queryRunner.manager.getRepository(CharacterSpell);
    const existingSpells = new Set((character.spells || []).map(s => s.spellName));
    const newSpells = new Set(sanitizeArray(updates.spells));

    const spellsToAdd = [...newSpells].filter(s => !existingSpells.has(s));
    const spellsToRemove = [...existingSpells].filter(s => !newSpells.has(s));

    if (spellsToRemove.length) {
        await spellsRepo.delete({ characterId, spellName: In(spellsToRemove) });
    }
    if (spellsToAdd.length) {
      const newEntities = spellsToAdd.map(name => spellsRepo.create({ characterId, spellName: name }));
      await spellsRepo.save(newEntities);
    }
  }

  // --- Relationships + Quests (Upsert/Delete recursivo) ---
    if (updates.relationships && Array.isArray(updates.relationships)) {
        const relationshipRepo = queryRunner.manager.getRepository(Relationship);
        const questRepo = queryRunner.manager.getRepository(Quest);
        
        // Sanitize and get all npcIds from the AI update
        const sanitizedRels = sanitizeArray(updates.relationships);
        const aiRelIds = new Set(sanitizedRels.map((r: any) => {
            return r.npcId || r.name.toLowerCase().replace(/\s+/g, '_');
        }).filter(Boolean));

        // Delete relationships that are no longer in the AI's response
        for (const rel of character.relationships || []) {
            if (!aiRelIds.has(rel.npcId)) {
                await relationshipRepo.remove(rel);
            }
        }

        for (const relData of sanitizedRels) {
            // Generate a unique npcId from the name if it's missing
            const npcId = relData.npcId || relData.name.toLowerCase().replace(/\s+/g, '_');
            if (!npcId) continue; // Skip if there's no name to generate an ID from

            let rel = (character.relationships || []).find(r => r.npcId === npcId);
            if (!rel) {
                rel = relationshipRepo.create({ characterId, npcId });
            }

            Object.assign(rel, { 
                name: relData.name, 
                description: relData.description, 
                status: relData.status, 
                affinity: relData.affinity 
            });
            const savedRel = await relationshipRepo.save(rel);

            const aiQuestIds = new Set((relData.quests || []).map((q: any) => q.id).filter(Boolean));
            const existingQuests = savedRel.quests || [];

            for (const q of existingQuests) {
                if (!aiQuestIds.has(q.id)) {
                    await questRepo.remove(q);
                }
            }
            
            for (const questData of sanitizeArray(relData.quests)) {
                let quest = existingQuests.find(q => q.id === questData.id);
                if (!quest) {
                    quest = questRepo.create({ id: questData.id || uuidv4(), relationshipId: savedRel.id });
                }

                Object.assign(quest, { 
                    title: questData.title, 
                    status: questData.status, 
                    objectives: questData.objectives 
                });
                await questRepo.save(quest);
            }
        }
    }


  // --- Journal Entries (Upsert/Delete recursivo) ---
  if (updates.journal) {
      // Para o diário, é mais seguro apagar as entradas de nível superior e recriar a árvore,
      // para refletir corretamente a hierarquia e as exclusões.
      const journalRepo = queryRunner.manager.getRepository(JournalEntry);
      const topLevelEntries = (character.journal || []).filter(j => !j.parentLocation);
      if (topLevelEntries.length > 0) {
        await journalRepo.remove(topLevelEntries);
      }
      await upsertJournalEntries(queryRunner, updates.journal, characterId);
  }
};

    