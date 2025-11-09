// backend/src/services/aiSanitizer.ts
import { GameMasterResponse } from "../schemas/gameSchemas.js";
import { HomebrewContentType } from "../entities/HomebrewContent.js";
import type { InventoryLike } from './inventoryService.js';

const VALID_HOMEBREW_TYPES: HomebrewContentType[] = ['race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'];
const VALID_RELATIONSHIP_STATUSES = new Set(['hostile', 'unfriendly', 'neutral', 'friendly', 'ally']);
const LOG_ENTRY_ALLOWED_TYPES = new Set(['narration', 'action', 'system', 'combat', 'insight', 'roll']);
const LOG_ENTRY_TYPE_ALIASES: Record<string, string> = {
    gm: 'narration',
    game: 'narration',
    narrator: 'narration',
    mestre: 'narration',
    player: 'action',
    jogador: 'action',
    personagem: 'action',
    npc: 'action',
};
const COMBAT_ZONE_ALLOWED = new Set(['perto', 'medio', 'longe', 'coberto']);
const COMBAT_ZONE_ALIASES: Record<string, string> = {
    melee: 'perto',
    close: 'perto',
    near: 'perto',
    short: 'perto',
    ranged: 'medio',
    range: 'medio',
    mid: 'medio',
    medium: 'medio',
    afar: 'longe',
    far: 'longe',
    long: 'longe',
    distant: 'longe',
    cover: 'coberto',
    covered: 'coberto',
};
const ROLL_TYPE_ALLOWED = new Set(['check', 'save', 'attack', 'damage', 'initiative']);
const ROLL_TYPE_ALIASES: Record<string, string> = {
    skillcheck: 'check',
    'skill check': 'check',
    abilitycheck: 'check',
    ability: 'check',
    skill: 'check',
    savingthrow: 'save',
    'saving throw': 'save',
    attackroll: 'attack',
    'attack roll': 'attack',
    damageroll: 'damage',
    'damage roll': 'damage',
};
const PROGRESSION_TYPE_ALLOWED = new Set(['xp_gain', 'level_up']);
const PROGRESSION_TYPE_ALIASES: Record<string, 'xp_gain' | 'level_up'> = {
    xp: 'xp_gain',
    'xp_gain': 'xp_gain',
    'xp gain': 'xp_gain',
    'xp-gain': 'xp_gain',
    experience: 'xp_gain',
    reward: 'xp_gain',
    progress: 'xp_gain',
    progresso: 'xp_gain',
    level: 'level_up',
    'level_up': 'level_up',
    'level up': 'level_up',
    'level-up': 'level_up',
    levelup: 'level_up',
    subir: 'level_up',
};

/**
 * Normaliza a string 'timeOfDay' para um valor de enumeração conhecido.
 * @param timeOfDayString A string de tempo vinda da IA.
 * @returns Um valor de enumeração ('Manhã', 'Tarde', 'Noite') ou o valor original se não houver correspondência.
 */
const normalizeTimeOfDay = (timeOfDayString: string): string => {
    if (!timeOfDayString) return 'Manhã';
    const lowerCaseTime = timeOfDayString.toLowerCase();

    if (lowerCaseTime.includes('manhã') || lowerCaseTime.includes('alvorecer')) {
        return 'Manhã';
    }
    if (lowerCaseTime.includes('tarde') || lowerCaseTime.includes('crepúsculo') || lowerCaseTime.includes('pôr do sol')) {
        return 'Tarde';
    }
    if (lowerCaseTime.includes('noite') || lowerCaseTime.includes('meia-noite')) {
        return 'Noite';
    }
    
    return timeOfDayString; 
};

/**
 * Normaliza a string 'weather' para um valor conhecido.
 * @param weatherString A string de clima vinda da IA.
 * @returns Um valor de enumeração ou o valor original se não houver correspondência.
 */
const normalizeWeather = (weatherString: string): string => {
    if (!weatherString) return 'Ensolarado';
    const lowerCaseWeather = weatherString.toLowerCase();
    
    const weatherMap: Record<string, string> = {
        'chuvoso': 'Chuva',
        'chovendo': 'Chuva',
        'nevando': 'Neve',
        'tempestuoso': 'Tempestade',
        'ensolarado': 'Ensolarado',
        'ensonarado': 'Ensolarado', // Corrigindo erro de digitação comum da IA
        'nublado': 'Nublado',
        'nevoeiro': 'Nevoeiro',
    };

    for (const key in weatherMap) {
        if (lowerCaseWeather.includes(key)) {
            return weatherMap[key];
        }
    }
    
    const knownWeathers = ['Ensolarado', 'Nublado', 'Chuva', 'Tempestade', 'Neve', 'Nevoeiro'];
    const found = knownWeathers.find(w => lowerCaseWeather.includes(w.toLowerCase()));
    return found || 'Ensolarado';
};

const DEFAULT_WORLD_STATE = {
    timeOfDay: 'Manhã',
    weather: 'Ensolarado',
    currentRegion: 'Desconhecida',
};

const normalizeCombatZone = (zone: any): string | undefined => {
    if (!zone || typeof zone !== 'string') return undefined;
    const key = zone.trim().toLowerCase();
    if (COMBAT_ZONE_ALLOWED.has(key)) return key;
    return COMBAT_ZONE_ALIASES[key];
};

const normalizeRollType = (value: any): string | undefined => {
    if (!value || typeof value !== 'string') return undefined;
    const key = value.trim().toLowerCase();
    if (ROLL_TYPE_ALLOWED.has(key)) return key;
    return ROLL_TYPE_ALIASES[key];
};
const normalizeProgressionType = (value: any): 'xp_gain' | 'level_up' | undefined => {
    if (!value || typeof value !== 'string') return undefined;
    const key = value.trim().toLowerCase();
    if (PROGRESSION_TYPE_ALLOWED.has(key)) return key as 'xp_gain' | 'level_up';
    return PROGRESSION_TYPE_ALIASES[key];
};

const buildSafeWorldState = (source?: any, fallbackRegion?: string) => {
    const base = (source && typeof source === 'object') ? source : {};
    const timeOfDay = normalizeTimeOfDay(typeof base.timeOfDay === 'string' ? base.timeOfDay : '');
    const weather = normalizeWeather(typeof base.weather === 'string' ? base.weather : '');
    const currentRegion = base.currentRegion ?? fallbackRegion ?? DEFAULT_WORLD_STATE.currentRegion;
    return {
        ...base,
        timeOfDay,
        weather,
        currentRegion,
    };
};

/**
 * Sanitiza a resposta validada da IA para garantir consistência lógica e semântica.
 * Atua como a camada final de "senso de jogo" antes de retornar a resposta.
 * @param responseData A resposta da IA, que PODE conter campos nulos ou malformados.
 * @param currentCharacter O estado atual do personagem, para fallback.
 * @returns Um objeto GameMasterResponse logicamente coerente e seguro.
 */
export const sanitizeGameMasterResponse = (responseData: any, currentCharacter?: any): GameMasterResponse => {
  if (!responseData || typeof responseData !== 'object') {
    return {
      logEntries: [{ type: 'system', content: 'A resposta da IA foi inválida ou vazia.' }],
      actionOptions: [],
    };
  }

  const sanitized: Partial<GameMasterResponse> = { ...responseData };
  const sanitationLogs: string[] = [];
  const buildInventoryKey = (item: any): string | null => {
    if (!item) return null;
    const raw = item.id || item.index || item.name;
    return raw ? String(raw).toLowerCase() : null;
  };

  const mergeInventoryItems = (
    incoming: InventoryLike[],
    previous: InventoryLike[] | undefined
  ): InventoryLike[] => {
    const snapshot = new Map<string, InventoryLike>();

    if (Array.isArray(previous)) {
      for (const item of previous) {
        const key = buildInventoryKey(item);
        if (key) {
          snapshot.set(key, { ...item });
        }
      }
    }

    if (!Array.isArray(incoming)) {
      return Array.from(snapshot.values());
    }

    for (const item of incoming) {
      if (!item) continue;
      const key = buildInventoryKey(item);

      if (!key) {
        const generatedKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        snapshot.set(generatedKey, { ...item });
        continue;
      }

      if (item.remove === true || item._delete === true) {
        snapshot.delete(key);
        continue;
      }

      const previousItem = snapshot.get(key);
      if (previousItem) {
        snapshot.set(key, { ...previousItem, ...item });
      } else {
        snapshot.set(key, { ...item });
      }
    }

    return Array.from(snapshot.values());
  };

  const toNumber = (value: any): number | undefined => {
    if (value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const parseHitDieKey = (value: any): number | undefined => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'number' && Number.isFinite(value)) {
      const intValue = Math.floor(Math.abs(value));
      return intValue > 0 ? intValue : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      const dieMatch = trimmed.match(/d(\d+)/);
      if (dieMatch) {
        const dieValue = Number(dieMatch[1]);
        return Number.isFinite(dieValue) && dieValue > 0 ? dieValue : undefined;
      }
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric) && numeric > 0) {
        return Math.floor(numeric);
      }
    }
    return undefined;
  };

  const normalizeUseHitDice = (value: any): { maxDice: number; hitDieValue: number } | undefined => {
    if (!value || typeof value !== 'object') return undefined;

    const clampPositiveInt = (input: any): number | undefined => {
      const parsed = toNumber(input);
      if (parsed === undefined) return undefined;
      const intValue = Math.floor(parsed);
      return intValue > 0 ? intValue : undefined;
    };

    const directMax = clampPositiveInt(value.maxDice ?? value.availableDice ?? value.quantity ?? value.remainingDice);
    const directDie = clampPositiveInt(value.hitDieValue ?? value.hitDie ?? value.dieValue ?? value.die);
    const parsedDie = parseHitDieKey(value.hitDie ?? value.die ?? value.hitDieValue ?? value.dieValue);
    if (directMax && (directDie || parsedDie)) {
      return { maxDice: directMax, hitDieValue: (directDie ?? parsedDie)! };
    }

    if (value.availableHitDice && typeof value.availableHitDice === 'object') {
      for (const [dieKey, qty] of Object.entries(value.availableHitDice)) {
        const dieValue = parseHitDieKey(dieKey);
        const maxDice = clampPositiveInt(qty);
        if (dieValue && maxDice) {
          return { maxDice, hitDieValue: dieValue };
        }
      }
    }

    if (Array.isArray(value.diceOptions)) {
      for (const option of value.diceOptions) {
        if (!option || typeof option !== 'object') continue;
        const dieValue = parseHitDieKey(option.die ?? option.size ?? option.type);
        const maxDice = clampPositiveInt(option.max ?? option.quantity ?? option.count);
        if (dieValue && maxDice) {
          return { maxDice, hitDieValue: dieValue };
        }
      }
    }

    if (value.hitDice && typeof value.hitDice === 'object') {
      const dieValue = parseHitDieKey(value.hitDice.die ?? value.hitDice.type);
      const maxDice = clampPositiveInt(value.hitDice.available ?? value.hitDice.remaining);
      if (dieValue && maxDice) {
        return { maxDice, hitDieValue: dieValue };
      }
    }

    return undefined;
  };

  const extractHpPair = (source: any): { current?: number; max?: number } | undefined => {
    if (!source || typeof source !== 'object') return undefined;
    let current = undefined;
    let max = undefined;

    const objectCandidates = [
      source.hp,
      source.attributes?.hp,
      source.stats?.hp,
      source.health,
    ];
    for (const candidate of objectCandidates) {
      if (typeof candidate === 'number') {
        current = current ?? toNumber(candidate);
      } else if (candidate && typeof candidate === 'object') {
        if (candidate.current !== undefined) current = current ?? toNumber(candidate.current);
        if (candidate.value !== undefined) current = current ?? toNumber(candidate.value);
        if (candidate.remaining !== undefined) current = current ?? toNumber(candidate.remaining);
        if (candidate.max !== undefined) max = max ?? toNumber(candidate.max);
        if (candidate.maximum !== undefined) max = max ?? toNumber(candidate.maximum);
        if (candidate.total !== undefined) max = max ?? toNumber(candidate.total);
      }
    }

    const currentCandidates = [
      source.hpCurrent,
      source.currentHp,
      source.remainingHp,
      source.current_health,
      source.healthCurrent,
    ];
    for (const candidate of currentCandidates) {
      const value = toNumber(candidate);
      if (value !== undefined) {
        current = current ?? value;
        break;
      }
    }

    const maxCandidates = [
      source.hpMax,
      source.maxHp,
      source.totalHp,
      source.healthMax,
      source.max_health,
    ];
    for (const candidate of maxCandidates) {
      const value = toNumber(candidate);
      if (value !== undefined) {
        max = max ?? value;
        break;
      }
    }

    if (current === undefined && max === undefined) return undefined;
    if (current === undefined) current = max ?? 0;
    if (max === undefined) max = current;
    return { current, max };
  };

  const getPlayerFallbackHp = () => {
    const updatedAttrs = sanitized.updatedCharacter?.attributes;
    const charAttrs = currentCharacter?.attributes;
    const current = toNumber(updatedAttrs?.hp) ?? toNumber(charAttrs?.hp);
    const max = toNumber(updatedAttrs?.maxHp) ?? toNumber(charAttrs?.maxHp) ?? toNumber(charAttrs?.hp);
    return current !== undefined || max !== undefined
      ? { current: current ?? max ?? 0, max: max ?? current ?? 0 }
      : undefined;
  };

  if (sanitized.updatedCharacter && Array.isArray(sanitized.updatedCharacter.inventory)) {
    const previousItems = Array.isArray(currentCharacter?.inventory) ? currentCharacter!.inventory : [];
    sanitized.updatedCharacter.inventory = mergeInventoryItems(
      sanitized.updatedCharacter.inventory,
      previousItems
    );
  } else if (!sanitized.updatedCharacter?.inventory && Array.isArray(currentCharacter?.inventory)) {
    sanitized.updatedCharacter = {
      ...(sanitized.updatedCharacter || {}),
      inventory: currentCharacter.inventory.slice(),
    };
  }

  if (sanitized.updatedCharacter) {
    console.log('[aiSanitizer] updatedCharacter após merge', sanitized.updatedCharacter);
  }



  // Sanitize logEntries
  if (Array.isArray(sanitized.logEntries)) {
    sanitized.logEntries = sanitized.logEntries
      .map((entry: any) => {
        if (!entry || typeof entry !== 'object' || !entry.content) return null;
        let content = typeof entry.content === 'object' ? JSON.stringify(entry.content) : String(entry.content);
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed.content === 'string') {
            content = parsed.content;
          }
        } catch (e) { /* Ignore */ }

        content = content.replace(/<\/?narration>/g, '').trim();
        if (!content) return null;

        let type = typeof entry.type === 'string' ? entry.type.toLowerCase().trim() : 'narration';
        if (!LOG_ENTRY_ALLOWED_TYPES.has(type)) {
          type = LOG_ENTRY_TYPE_ALIASES[type] ?? 'narration';
        }

        return { type, content, rollResult: entry.rollResult };
      })
      .filter(Boolean);
  } else {
    sanitized.logEntries = [];
    sanitationLogs.push('logEntries não era um array, resetado para [].');
  }
  if (sanitized.logEntries.length === 0) {
    sanitized.logEntries.push({
      type: 'narration',
      content: 'O tempo passa calmamente enquanto o herói considera suas próximas ações.',
    });
    sanitationLogs.push('logEntries estava vazio, adicionada narração padrão.');
  }
  
  // Sanitize actionOptions
  if (Array.isArray(sanitized.actionOptions)) {
    sanitized.actionOptions = sanitized.actionOptions.map(option => {
        if (typeof option === 'string') {
            return option;
        }
        if (typeof option === 'object' && option !== null && option.text) {
            // If it's an object with `text` but missing `action`, create a default action.
            if (!option.action) {
                option.action = option.text.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50);
                sanitationLogs.push(`actionOption "${option.text}" teve um campo 'action' gerado automaticamente.`);
            }
            return option;
        }
        return null; // Discard invalid options
    }).filter(Boolean);
  } else {
    sanitized.actionOptions = [];
    sanitationLogs.push('actionOptions não era um array, resetado para [].');
  }
  if (sanitized.actionOptions.length === 0) {
    sanitized.actionOptions = [
      'Observar o ambiente em busca de algo incomum.',
      'Ouvir conversas próximas para recolher boatos.',
      'Conversar com o NPC mais próximo.',
    ];
    sanitationLogs.push('actionOptions estava vazio, adicionadas opções padrão.');
  }

  if (sanitized.ambientSound !== undefined) {
    if (typeof sanitized.ambientSound !== 'string' || !sanitized.ambientSound.trim()) {
      delete sanitized.ambientSound;
      sanitationLogs.push('ambientSound inválido removido.');
    } else {
      sanitized.ambientSound = sanitized.ambientSound.trim().slice(0, 80);
    }
  }

  if (!sanitized.gameClock || typeof sanitized.gameClock !== 'object') {
    sanitized.gameClock = { day: 0, hour: 12, weather: sanitized.worldState?.weather ?? 'clear' };
  } else {
    sanitized.gameClock.day = toNumber(sanitized.gameClock.day) ?? 0;
    sanitized.gameClock.hour = toNumber(sanitized.gameClock.hour) ?? 12;
    sanitized.gameClock.weather = typeof sanitized.gameClock.weather === 'string'
      ? sanitized.gameClock.weather
      : (sanitized.worldState?.weather ?? 'clear');
  }

  if (!sanitized.memoryContext || typeof sanitized.memoryContext !== 'object') {
    sanitized.memoryContext = { summary: '', references: [] };
  } else {
    if (typeof sanitized.memoryContext.summary !== 'string') {
      sanitized.memoryContext.summary = '';
    } else {
      sanitized.memoryContext.summary = sanitized.memoryContext.summary.slice(0, 500);
    }
    if (!Array.isArray(sanitized.memoryContext.references)) {
      sanitized.memoryContext.references = [];
    } else {
      sanitized.memoryContext.references = sanitized.memoryContext.references
        .map((item: any) => (typeof item === 'string' ? item.slice(0, 120) : null))
        .filter(Boolean);
    }
  }

  if (sanitized.shopState && typeof sanitized.shopState === 'object') {
    sanitized.shopState.isOpen = Boolean(sanitized.shopState.isOpen ?? true);
    sanitized.shopState.isHaggling = Boolean(sanitized.shopState.isHaggling ?? false);
    sanitized.shopState.name = sanitized.shopState.name ?? sanitized.shopState.merchant?.name ?? 'Empório';
    sanitized.shopState.inventory = Array.isArray(sanitized.shopState.inventory)
      ? sanitized.shopState.inventory
      : [];
    sanitized.shopState.sellPrices = sanitized.shopState.sellPrices && typeof sanitized.shopState.sellPrices === 'object'
      ? sanitized.shopState.sellPrices
      : {};
    if (sanitized.shopState.inventory.length === 0 && typeof sanitized.shopState.inventorySummary === 'string') {
      sanitized.shopState.inventory.push({
        id: 'summary',
        name: sanitized.shopState.inventorySummary,
        description: sanitized.shopState.inventorySummary,
      });
    }
  }

  if (Array.isArray((sanitized as any).xpEvents)) {
    (sanitized as any).xpEvents = (sanitized as any).xpEvents
      .map((event: any) => {
        if (!event || typeof event !== 'object') return null;
        const { type } = event;
        if (type !== 'skill' && type !== 'quest' && type !== 'combat') return null;
        const xpEvent: Record<string, any> = { type };
        if (type === 'skill' || type === 'combat') {
            if (typeof event.dc === 'number' && Number.isFinite(event.dc)) xpEvent.dc = event.dc;
            if (typeof event.difficulty === 'string') xpEvent.difficulty = event.difficulty;
        }
        if (type === 'quest') {
            if (typeof event.dc === 'number' && Number.isFinite(event.dc)) xpEvent.dc = event.dc;
            if (typeof event.difficulty === 'string') xpEvent.difficulty = event.difficulty;
            if (typeof event.questLevel === 'number' && Number.isFinite(event.questLevel)) xpEvent.questLevel = event.questLevel;
        }
        if (event.description && typeof event.description === 'string') xpEvent.description = event.description.slice(0, 140);
        return xpEvent;
      })
      .filter(Boolean);
  } else if ((sanitized as any).xpEvents !== undefined) {
    delete (sanitized as any).xpEvents;
    sanitationLogs.push('xpEvents inválido removido.');
  }

  if (Array.isArray((sanitized as any).progressionFeed)) {
    const normalizedProgression = (sanitized as any).progressionFeed
      .map((entry: any, index: number) => {
        if (!entry || typeof entry !== 'object') {
          sanitationLogs.push(`progressionFeed[${index}] removido por formato inválido.`);
          return null;
        }
        const normalizedType = normalizeProgressionType(entry.type);
        if (!normalizedType) {
          sanitationLogs.push(`progressionFeed[${index}] teve tipo inválido "${entry.type}" e foi descartado.`);
          return null;
        }
        const summary = typeof entry.summary === 'string' ? entry.summary.trim() : '';
        if (!summary) {
          sanitationLogs.push(`progressionFeed[${index}] sem summary válido foi removido.`);
          return null;
        }
        const normalizedEntry: Record<string, any> = {
          type: normalizedType,
          summary: summary.slice(0, 240),
        };
        if (typeof entry.source === 'string' && entry.source.trim()) {
          normalizedEntry.source = entry.source.trim().slice(0, 160);
        }
        if (typeof entry.detail === 'string' && entry.detail.trim()) {
          normalizedEntry.detail = entry.detail.trim().slice(0, 280);
        }
        const xpValue = toNumber(entry.xp ?? entry.reward);
        if (xpValue !== undefined) {
          normalizedEntry.xp = xpValue;
        }
        const levelValue = toNumber(entry.level ?? entry.levelReached ?? entry.newLevel);
        if (levelValue !== undefined) {
          normalizedEntry.level = levelValue;
        }
        return normalizedEntry;
      })
      .filter(Boolean);
    if (normalizedProgression.length > 0) {
      (sanitized as any).progressionFeed = normalizedProgression;
    } else {
      delete (sanitized as any).progressionFeed;
      sanitationLogs.push('progressionFeed removido por não conter entradas válidas.');
    }
  } else if ((sanitized as any).progressionFeed !== undefined) {
    delete (sanitized as any).progressionFeed;
    sanitationLogs.push('progressionFeed inválido removido.');
  }
  
  // Sanitize worldState
  const characterWorldState = buildSafeWorldState(currentCharacter?.worldState, currentCharacter?.currentRegion);
  if (!sanitized.worldState || typeof sanitized.worldState !== 'object' || Object.keys(sanitized.worldState).length === 0) {
    sanitized.worldState = characterWorldState;
    sanitationLogs.push('worldState era inválido, restaurado para o estado anterior ou padrão.');
  } else {
    const mergedWorldState = {
        ...characterWorldState,
        ...sanitized.worldState,
    };
    const originalTimeOfDay = mergedWorldState.timeOfDay;
    const originalWeather = mergedWorldState.weather;
    mergedWorldState.timeOfDay = normalizeTimeOfDay(mergedWorldState.timeOfDay);
    mergedWorldState.weather = normalizeWeather(mergedWorldState.weather);
    sanitized.worldState = mergedWorldState;
    if(mergedWorldState.timeOfDay !== originalTimeOfDay) {
        sanitationLogs.push(`worldState.timeOfDay normalizado de "${originalTimeOfDay}" para "${mergedWorldState.timeOfDay}".`);
    }
    if(mergedWorldState.weather !== originalWeather) {
        sanitationLogs.push(`worldState.weather normalizado de "${originalWeather}" para "${mergedWorldState.weather}".`);
    }
  }

  // previous duplicate merge block removed

  // **NOVO**: Sanitize combatState de forma agressiva
  if (sanitized.combatState) {
      if (!sanitized.combatState.isActive) {
          sanitized.combatState = undefined;
          sanitationLogs.push(`combatState.isActive é falso, definindo combatState como undefined.`);
      } else {
          const normalizeNumber = (value: any, fallback: number) => {
              const num = Number(value);
              return Number.isFinite(num) ? num : fallback;
          };

          const rawRound = sanitized.combatState.round ?? sanitized.combatState.currentRound ?? 1;
          const rawTurn = sanitized.combatState.turn ?? sanitized.combatState.currentTurn ?? sanitized.combatState.activeCombatantIndex ?? 0;
          sanitized.combatState.round = normalizeNumber(rawRound, 1);
          sanitized.combatState.turn = normalizeNumber(rawTurn, 0);

          if (!Array.isArray(sanitized.combatState.initiativeOrder)) {
              if (Array.isArray(sanitized.combatState.combatants)) {
                  sanitized.combatState.initiativeOrder = sanitized.combatState.combatants
                      .map((c: any) => c?.id)
                      .filter(Boolean);
              } else {
                  sanitized.combatState.initiativeOrder = [];
              }
          } else {
              sanitized.combatState.initiativeOrder = sanitized.combatState.initiativeOrder
                  .map(entry => entry ? String(entry) : null)
                  .filter(Boolean) as string[];
          }

          let combatantsSource: any = sanitized.combatState.combatants;
          if (!Array.isArray(combatantsSource) && combatantsSource && typeof combatantsSource === 'object') {
              combatantsSource = Object.values(combatantsSource);
          }
          if (!Array.isArray(combatantsSource)) {
              combatantsSource = [];
          }

          const playerHpFallback = getPlayerFallbackHp();
          const combatantIdRemap = new Map<string, string>();

          sanitized.combatState.combatants = combatantsSource.map((c: any) => {
              if (!c || typeof c !== 'object') return null; // Descarta combatentes inválidos

              const originalId = String(c.id ?? c.name ?? '');
              let normalizedId = originalId;
              if (c.id === 'player' || c.name === currentCharacter?.name || c.isPlayer) {
                  const playerCombatant = { ...c };
                  playerCombatant.id = 'player';
                  normalizedId = 'player';
                  playerCombatant.name = currentCharacter?.name || c.name || 'Player';
                  playerCombatant.isPlayer = true;
                  const derivedHp = extractHpPair(c) || playerHpFallback || { current: 0, max: 0 };
                  playerCombatant.hp = { current: derivedHp.current ?? 0, max: derivedHp.max ?? derivedHp.current ?? 0 };
                  if (playerCombatant.ac === undefined) {
                      playerCombatant.ac = toNumber(currentCharacter?.attributes?.ac) ?? 10;
                  }
                  if (playerCombatant.actionPoints === undefined) {
                      playerCombatant.actionPoints = 30;
                  }
                  if (playerCombatant.bonusActionPoints === undefined) {
                      playerCombatant.bonusActionPoints = 1;
                  }
                  if (playerCombatant.initiative === null) {
                      playerCombatant.initiative = undefined;
                  }
                  const zone = normalizeCombatZone(c.zone ?? c.position ?? c.distanceCategory);
                  if (zone) {
                      playerCombatant.zone = zone;
                  } else {
                      delete playerCombatant.zone;
                  }
                  combatantIdRemap.set(originalId.toLowerCase(), normalizedId);
                  return playerCombatant;
              }

              const derivedHp = extractHpPair(c);
              normalizedId = originalId || `npc-${Math.random().toString(36).slice(2, 8)}`;
              combatantIdRemap.set(originalId.toLowerCase(), normalizedId);

              const normalizedZone = normalizeCombatZone(c.zone ?? c.position ?? c.distanceCategory);
              const npcCombatant = {
                  ...c,
                  id: normalizedId,
                  ac: toNumber(c.ac) ?? 10,
                  hp: derivedHp ? { current: derivedHp.current ?? 0, max: derivedHp.max ?? derivedHp.current ?? 0 } : { current: 0, max: 0 },
                  initiative: c.initiative === null ? undefined : c.initiative,
              };
              if (normalizedZone) {
                  (npcCombatant as any).zone = normalizedZone;
              } else {
                  delete (npcCombatant as any).zone;
              }
              return npcCombatant;
          }).filter(Boolean); // Remove quaisquer entradas nulas

          const combatantIds = new Set(sanitized.combatState.combatants.map((c: any) => c.id));

          if (Array.isArray(sanitized.combatState.initiativeOrder)) {
              sanitized.combatState.initiativeOrder = sanitized.combatState.initiativeOrder
                  .map(id => {
                      if (!id) return null;
                      const remapped = combatantIdRemap.get(String(id).toLowerCase());
                      return remapped || String(id);
                  })
                  .filter(id => combatantIds.has(id!)) as string[];
          } else {
              sanitized.combatState.initiativeOrder = sanitized.combatState.combatants.map((c: any) => c.id);
          }

          if (sanitized.combatState.currentCombatantId) {
              const remapped = combatantIdRemap.get(String(sanitized.combatState.currentCombatantId).toLowerCase());
              if (remapped) {
                  sanitized.combatState.currentCombatantId = remapped;
              }
          }

          const playerExists = sanitized.combatState.combatants.some((c: any) => c.id === 'player');
          if (playerExists && !sanitized.combatState.initiativeOrder.includes('player')) {
              sanitized.combatState.initiativeOrder.splice(
                  Math.min(1, sanitized.combatState.initiativeOrder.length),
                  0,
                  'player'
              );
          }
          if (playerExists && !sanitized.combatState.currentCombatantId) {
              sanitized.combatState.currentCombatantId = 'player';
          }

          const currentIndex = sanitized.combatState.initiativeOrder.indexOf(
              sanitized.combatState.currentCombatantId || 'player'
          );
          if (currentIndex >= 0) {
              sanitized.combatState.turn = currentIndex;
          }
      }
  }

  // **NOVO**: Sanitize newHomebrewContent
  if (Array.isArray(sanitized.newHomebrewContent)) {
    sanitized.newHomebrewContent = sanitized.newHomebrewContent.map((content: any) => {
        if (!content || typeof content !== 'object' || !content.name) return null;
        
        let type = content.type;

        // Se o tipo é inválido ou ausente, tenta inferir.
        if (!type || !VALID_HOMEBREW_TYPES.includes(type)) {
            // Heurística: se tiver 'hit_points' e 'armor_class', é provavelmente um monstro.
            if (('hit_points' in content || 'hit_dice' in content) && 'armor_class' in content) {
                 sanitationLogs.push(`Conteúdo Homebrew "${content.name}" tinha tipo inválido '${type}', corrigido para "monster".`);
                 type = 'monster';
            } 
            // Heurística para itens/armas
            else if (['weapon', 'armor', 'gear', 'adventuring-gear'].includes(type) || 'cost' in content) {
                 sanitationLogs.push(`Conteúdo Homebrew "${content.name}" tinha tipo inválido '${type}', corrigido para "item".`);
                 type = 'item';
            }
            else {
                 return null; // Descarta se não for possível corrigir
            }
        }
        return {...content, type: type};
    }).filter(Boolean);
  }

  if (sanitized.updatedCharacter && typeof sanitized.updatedCharacter === 'object') {
    if (Array.isArray((sanitized.updatedCharacter as any).xpEvents) && !(sanitized as any).xpEvents) {
        (sanitized as any).xpEvents = (sanitized.updatedCharacter as any).xpEvents;
        delete (sanitized.updatedCharacter as any).xpEvents;
    }
    if (Array.isArray((sanitized.updatedCharacter as any).quests)) {
        (sanitized.updatedCharacter as any).quests = (sanitized.updatedCharacter as any).quests.filter((quest: any) => quest && quest.id);
    }

    if (Array.isArray((sanitized.updatedCharacter as any).relationships)) {
        (sanitized.updatedCharacter as any).relationships = (sanitized.updatedCharacter as any).relationships.map((rel: any) => {
            if (!rel || typeof rel !== 'object') return null;
            const normalized: any = { ...rel };
            if (!normalized.npcId && normalized.name) {
                normalized.npcId = normalized.name.toLowerCase().replace(/\s+/g, '_');
            }
            if (typeof normalized.status === 'string') {
                const statusValue = normalized.status.toLowerCase().trim();
                if (!VALID_RELATIONSHIP_STATUSES.has(statusValue)) {
                    const note = normalized.status;
                    normalized.status = 'neutral';
                    if (note) {
                        normalized.description = normalized.description
                            ? `${normalized.description}\n${note}`.trim()
                            : note;
                    }
                    sanitationLogs.push(`Relacionamento "${normalized.name || normalized.npcId}" teve status inválido e foi normalizado para 'neutral'.`);
                } else {
                    normalized.status = statusValue;
                }
            } else if (!normalized.status) {
                normalized.status = 'neutral';
            }
            return normalized;
        }).filter(Boolean);
    }
  }

  // Sanitize campos opcionais para serem undefined em vez de null/vazios.
  const fieldsToMakeUndefinedIfEmpty: (keyof GameMasterResponse)[] = [
    'playerRollRequest', 'levelUpState', 'shopState', 'lootOffer', 'useHitDiceRequest'
  ];

  fieldsToMakeUndefinedIfEmpty.forEach(field => {
      if (sanitized[field] === null || (typeof sanitized[field] === 'object' && Object.keys(sanitized[field]!).length === 0)) {
           (sanitized as any)[field] = undefined;
           sanitationLogs.push(`${String(field)} era nulo ou vazio, definido como undefined.`);
      }
  });

  if (sanitized.playerRollRequest && typeof sanitized.playerRollRequest === 'object') {
      if (sanitized.playerRollRequest.dc === null) {
          delete sanitized.playerRollRequest.dc;
          sanitationLogs.push('playerRollRequest.dc nulo removido.');
      }
      if (sanitized.playerRollRequest.rollType) {
          const normalizedRoll = normalizeRollType(sanitized.playerRollRequest.rollType);
          if (normalizedRoll) {
              sanitized.playerRollRequest.rollType = normalizedRoll as any;
          } else {
              delete sanitized.playerRollRequest.rollType;
              sanitationLogs.push('playerRollRequest.rollType inválido removido.');
          }
      }
  }

  if (sanitized.useHitDiceRequest && typeof sanitized.useHitDiceRequest === 'object') {
      const normalizedHitDice = normalizeUseHitDice(sanitized.useHitDiceRequest);
      if (normalizedHitDice) {
          sanitized.useHitDiceRequest = normalizedHitDice as any;
      } else {
          delete sanitized.useHitDiceRequest;
          sanitationLogs.push('useHitDiceRequest inválido removido.');
      }
  }

  if (sanitationLogs.length > 0) {
    const existingLog = sanitized.systemLog ? ` | ${sanitized.systemLog}` : '';
    sanitized.systemLog = `[Sanitizer Lógico] Correções: ${sanitationLogs.join(', ')}${existingLog}`;
  }

  return sanitized as GameMasterResponse;
};
