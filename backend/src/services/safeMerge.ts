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
import { clampCharacterLevel } from './xpService.js';
import { syncQuestKeywords } from './questKeywordService.js';

// Função auxiliar para limpar arrays de null/undefined
const sanitizeArray = <T>(arr?: T[]): T[] => Array.isArray(arr) ? arr.filter(Boolean) : [];

const canonicalSlug = (value?: string | null) => {
  if (!value) return null;
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || null;
};

const normalizeGameClockPayload = (
  incoming?: any,
  existing?: { day?: number; hour?: number; weather?: string } | null
) => {
  const fallbackDay = existing?.day ?? 0;
  const fallbackHour = existing?.hour ?? 0;
  const normalizedDay = Number.isFinite(Number(incoming?.day))
    ? Math.max(0, Number(incoming.day))
    : fallbackDay;
  const normalizedHour = Number.isFinite(Number(incoming?.hour))
    ? Math.max(0, Number(incoming.hour))
    : fallbackHour;
  const normalizedWeather =
    typeof incoming?.weather === 'string' && incoming.weather.trim().length
      ? incoming.weather.trim()
      : existing?.weather;
  return {
    day: normalizedDay,
    hour: normalizedHour,
    weather: normalizedWeather,
  };
};

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
  console.log('[mergeCharacterUpdates] iniciando', {
    characterId,
    updates,
  });
  const characterRepo = queryRunner.manager.getRepository(Character);
  const character = await characterRepo
    .createQueryBuilder('character')
    .select([
        'character',
        'attributes',
        'items',
        'spells',
        'journal',
        'journalSubLocations',
        'relationships',
        'relationshipQuests',
    ])
    .addSelect('character.id', 'Character_id')
    .leftJoinAndSelect('character.attributes', 'attributes')
    .leftJoinAndSelect('character.items', 'items')
    .leftJoinAndSelect('character.spells', 'spells')
    .leftJoinAndSelect('character.journal', 'journal')
    .leftJoinAndSelect('journal.subLocations', 'journalSubLocations')
    .leftJoinAndSelect('character.relationships', 'relationships')
    .leftJoinAndSelect('relationships.quests', 'relationshipQuests')
    .leftJoinAndSelect('relationshipQuests.keywords', 'questKeywords')
    .where('character.id = :id', { id: characterId })
    .getOne();

  if (!character) throw new Error('Personagem não encontrado para o merge.');

  // --- Campos diretos e objetos para merge ---
  const directPayload: Partial<Character> = {};
  const directFields = ['level', 'xp', 'storySoFar'] as const;
  directFields.forEach(field => {
    if (updates[field] !== undefined) {
      (directPayload as any)[field] = updates[field];
    }
  });

  if (directPayload.level !== undefined) {
    directPayload.level = clampCharacterLevel(Number(directPayload.level));
  }

  if (updates.factionReputation && typeof updates.factionReputation === 'object') {
    directPayload.factionReputation = { ...(character.factionReputation || {}), ...updates.factionReputation };
  }
  if (updates.worldState && typeof updates.worldState === 'object') {
    directPayload.worldState = { ...(character.worldState || {}), ...updates.worldState };
    if (updates.worldState.currentRegion) directPayload.currentRegion = updates.worldState.currentRegion;
  }
  if (updates.gameClock && typeof updates.gameClock === 'object') {
    directPayload.gameClock = normalizeGameClockPayload(updates.gameClock, character.gameClock);
  }
  if (Object.keys(directPayload).length > 0) {
    await characterRepo.update({ id: characterId }, directPayload);
  }

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
    const normalizeKey = (value?: string | number | null) => {
        if (value === undefined || value === null) return null;
        const str = typeof value === 'string' ? value : value.toString();
        return str.trim().toLowerCase() || null;
    };

    const existingItemsMap = new Map<string, CharacterItem>();
    for (const item of character.items || []) {
        const candidates = [
            normalizeKey(item.id),
            normalizeKey(item.itemData?.id),
            normalizeKey(item.itemData?.index),
            normalizeKey(item.name),
            normalizeKey(item.itemData?.name),
        ].filter(Boolean) as string[];
        for (const key of candidates) {
            if (!existingItemsMap.has(key)) {
                existingItemsMap.set(key, item);
            }
        }
    }

    for (const item of sanitizeArray(updates.inventory)) {
      if(!item) continue;
      const key =
        normalizeKey(item.id) ||
        normalizeKey(item.index) ||
        normalizeKey(item.name);
      const existing = key ? existingItemsMap.get(key) : undefined;
      const parsedQuantity = Number(item.quantity ?? (existing?.quantity ?? 1));
      const quantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 1;
      const requestedDeletion = item.remove === true || item._delete === true || quantity <= 0;
      
      if (requestedDeletion) {
        if (existing) {
            console.log('[mergeCharacterUpdates] removing item', existing.id);
            await itemsRepo.remove(existing);
        }
        continue;
      }

      const safeQuantity = quantity > 0 ? quantity : 1;

      if (existing) {
        console.log('[mergeCharacterUpdates] updating item', existing.id);
        const mergedItemData = {
            ...(existing.itemData || {}),
            ...item,
        };

        if (!mergedItemData.index && existing.itemData?.index) {
            mergedItemData.index = existing.itemData.index;
        }
        if (!mergedItemData.name && existing.itemData?.name) {
            mergedItemData.name = existing.itemData.name;
        }
        mergedItemData.quantity = safeQuantity;
        const nextEquipped = item.equipped !== undefined ? Boolean(item.equipped) : existing.equipped;
        mergedItemData.equipped = nextEquipped;
        mergedItemData.id = existing.id?.toString();

        existing.quantity = safeQuantity;
        existing.equipped = nextEquipped;
        existing.name = mergedItemData.name || existing.name;
        existing.itemData = mergedItemData;
        await itemsRepo.save(existing);
      } else {
        console.log('[mergeCharacterUpdates] inserting new item', { name: item.name || item.index, safeQuantity });
        const nextEquipped = item.equipped !== undefined ? Boolean(item.equipped) : false;
        const itemName = item.name || item.index || 'Item Desconhecido';
        const itemDataToPersist = {
            ...item,
            quantity: safeQuantity,
            equipped: nextEquipped,
        };
        const newItem = itemsRepo.create({
            characterId,
            name: itemName,
            quantity: safeQuantity,
            equipped: nextEquipped,
            itemData: itemDataToPersist,
        });
        await itemsRepo.save(newItem);
      }
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

            const locationData = relData.location || relData.lastKnownLocation || {};
            const regionSlug =
                canonicalSlug(relData.regionSlug) ||
                canonicalSlug(locationData.regionSlug || locationData.region);
            const poiSlug =
                canonicalSlug(relData.poiSlug) ||
                canonicalSlug(locationData.poiSlug || locationData.poi);
            const affinityValue = Number(relData.affinity);
            const resolvedAffinity = Number.isFinite(affinityValue) ? affinityValue : (rel.affinity ?? 0);
            Object.assign(rel, { 
                name: relData.name ?? rel.name, 
                description: relData.description ?? rel.description, 
                status: relData.status ?? rel.status ?? 'neutral', 
                affinity: resolvedAffinity 
            });
            if (relData.regionSlug === null || locationData?.regionSlug === null || locationData?.region === null) {
                rel.regionSlug = null;
            } else if (regionSlug) {
                rel.regionSlug = regionSlug;
            }
            if (relData.poiSlug === null || locationData?.poiSlug === null || locationData?.poi === null) {
                rel.poiSlug = null;
            } else if (poiSlug) {
                rel.poiSlug = poiSlug;
            }
            if (relData.locationNotes !== undefined) {
                rel.locationNotes = relData.locationNotes;
            } else if (locationData?.notes !== undefined) {
                rel.locationNotes = locationData.notes;
            }
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
                const syncedKeywords = await syncQuestKeywords(queryRunner.manager, quest, questData.keywords);
                quest.keywords = syncedKeywords;
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
  console.log('[mergeCharacterUpdates] finalizado', { characterId });
};

    
