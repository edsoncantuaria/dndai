// backend/src/services/aiSanitizer.ts
import { GameMasterResponse } from "../schemas/gameSchemas.js";
import { HomebrewContentType } from "../entities/HomebrewContent.js";
import { hydrateInventoryItems, reconcileCurrency } from "./inventoryService.js";

const VALID_HOMEBREW_TYPES: HomebrewContentType[] = ['race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'];
const VALID_RELATIONSHIP_STATUSES = new Set(['hostile', 'unfriendly', 'neutral', 'friendly', 'ally']);

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

  const mergeInventoryItems = (incoming: any[], previous: any[] | undefined) => {
    if (!Array.isArray(previous) || previous.length === 0) return incoming.slice();
    const map = new Map<string, any>();
    for (const item of previous) {
      const key = buildInventoryKey(item);
      if (key) map.set(key, item);
    }
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const item of incoming) {
      const key = buildInventoryKey(item);
      if (key) {
        seen.add(key);
      }
      const fallback = key ? map.get(key) : null;
      merged.push(fallback ? { ...fallback, ...item } : item);
    }
    for (const [key, item] of map.entries()) {
      if (!seen.has(key)) merged.push(item);
    }
    return merged;
  };

  const toNumber = (value: any): number | undefined => {
    if (value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
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
    sanitized.updatedCharacter.inventory = mergeInventoryItems(sanitized.updatedCharacter.inventory, previousItems);
    const userId = currentCharacter?.userId || currentCharacter?.playerId || 0;
    hydrateInventoryItems(sanitized.updatedCharacter.inventory, userId, previousItems).then(({ items, metrics }) => {
      sanitized.updatedCharacter!.inventory = items as any;
      sanitized.updatedCharacter!.currency = reconcileCurrency(
        sanitized.updatedCharacter!.currency,
        metrics.currency
      );
      sanitized.updatedCharacter!.currentWeight = metrics.totalWeight;
    }).catch(() => {
      sanitized.updatedCharacter!.currency = sanitized.updatedCharacter!.currency || { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    });
  } else if (!sanitized.updatedCharacter?.inventory && Array.isArray(currentCharacter?.inventory)) {
    sanitized.updatedCharacter = {
      ...(sanitized.updatedCharacter || {}),
      inventory: currentCharacter.inventory.slice(),
    };
  }



  // Sanitize logEntries
  if (Array.isArray(sanitized.logEntries)) {
    sanitized.logEntries = sanitized.logEntries.map((entry: any) => {
      if (!entry || typeof entry !== 'object' || !entry.content) return null;
      let content = typeof entry.content === 'object' ? JSON.stringify(entry.content) : String(entry.content);
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed.content === 'string') {
          content = parsed.content;
        }
      } catch (e) { /* Ignore */ }
      
      content = content.replace(/<\/?narration>/g, '').trim();
      return content ? { type: entry.type || 'narration', content, rollResult: entry.rollResult } : null;
    }).filter(Boolean);
  } else {
    sanitized.logEntries = [];
    sanitationLogs.push('logEntries não era um array, resetado para [].');
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

  if (Array.isArray((sanitized as any).xpEvents)) {
    (sanitized as any).xpEvents = (sanitized as any).xpEvents
      .map((event: any) => {
        if (!event || typeof event !== 'object') return null;
        const { type } = event;
        if (type !== 'skill' && type !== 'quest') return null;
        const xpEvent: Record<string, any> = { type };
        if (type === 'skill') {
            if (typeof event.dc === 'number' && Number.isFinite(event.dc)) xpEvent.dc = event.dc;
            if (typeof event.difficulty === 'string') xpEvent.difficulty = event.difficulty;
        }
        if (type === 'quest') {
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
  
  // Sanitize worldState
  if (!sanitized.worldState || typeof sanitized.worldState !== 'object' || Object.keys(sanitized.worldState).length === 0) {
    sanitized.worldState = currentCharacter?.worldState || { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Desconhecida' };
    sanitationLogs.push('worldState era inválido, restaurado para o estado anterior ou padrão.');
  } else {
    const originalTimeOfDay = sanitized.worldState.timeOfDay;
    const originalWeather = sanitized.worldState.weather;
    const normalizedTimeOfDay = normalizeTimeOfDay(originalTimeOfDay);
    const normalizedWeather = normalizeWeather(originalWeather);
    
    sanitized.worldState = { 
        ...(currentCharacter?.worldState || {}), 
        ...sanitized.worldState,
        timeOfDay: normalizedTimeOfDay,
        weather: normalizedWeather,
    };
    if(normalizedTimeOfDay !== originalTimeOfDay) {
        sanitationLogs.push(`worldState.timeOfDay normalizado de "${originalTimeOfDay}" para "${normalizedTimeOfDay}".`);
    }
    if(normalizedWeather !== originalWeather) {
        sanitationLogs.push(`worldState.weather normalizado de "${originalWeather}" para "${normalizedWeather}".`);
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
                      playerCombatant.ac = toNumber(currentCharacter?.attributes?.ac) ?? playerCombatant.ac;
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
                  combatantIdRemap.set(originalId.toLowerCase(), normalizedId);
                  return playerCombatant;
              }

              const derivedHp = extractHpPair(c);
              normalizedId = originalId || `npc-${Math.random().toString(36).slice(2, 8)}`;
              combatantIdRemap.set(originalId.toLowerCase(), normalizedId);

              return {
                  ...c,
                  id: normalizedId,
                  hp: derivedHp ? { current: derivedHp.current ?? 0, max: derivedHp.max ?? derivedHp.current ?? 0 } : { current: 0, max: 0 },
                  initiative: c.initiative === null ? undefined : c.initiative,
              };
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
  }

  if (sanitationLogs.length > 0) {
    const existingLog = sanitized.systemLog ? ` | ${sanitized.systemLog}` : '';
    sanitized.systemLog = `[Sanitizer Lógico] Correções: ${sanitationLogs.join(', ')}${existingLog}`;
  }

  return sanitized as GameMasterResponse;
};
