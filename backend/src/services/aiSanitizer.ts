// backend/src/services/aiSanitizer.ts
import { GameMasterResponse } from "../schemas/gameSchemas.js";
import { HomebrewContentType } from "../entities/HomebrewContent.js";

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
  if (sanitized.updatedCharacter?.inventory && Array.isArray(currentCharacter?.inventory)) {
    const previousItems = currentCharacter.inventory as any[];
    const mergeMap = new Map<string, any>();
    for (const item of previousItems) {
      const key = (item?.id || item?.index || item?.name || '').toString().toLowerCase();
      if (key) mergeMap.set(key, item);
    }
    sanitized.updatedCharacter.inventory = sanitized.updatedCharacter.inventory.map((item: any) => {
      if (!item) return item;
      const key = (item.id || item.index || item.name || '').toString().toLowerCase();
      const fallback = key ? mergeMap.get(key) : null;
      return fallback ? { ...fallback, ...item } : item;
    });
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

  if (sanitized.updatedCharacter?.inventory && Array.isArray(currentCharacter?.inventory)) {
    const previousItems = currentCharacter.inventory as any[];
    const mergeMap = new Map<string, any>();
    for (const item of previousItems) {
      const key = (item?.id || item?.index || item?.name || '').toString().toLowerCase();
      if (key) mergeMap.set(key, item);
    }
    sanitized.updatedCharacter.inventory = sanitized.updatedCharacter.inventory.map((item: any) => {
      if (!item) return item;
      const key = (item.id || item.index || item.name || '').toString().toLowerCase();
      const fallback = key ? mergeMap.get(key) : null;
      return fallback ? { ...fallback, ...item } : item;
    });
  }

  // **NOVO**: Sanitize combatState de forma agressiva
  if (sanitized.combatState) {
      if (!sanitized.combatState.isActive) {
          sanitized.combatState = undefined;
          sanitationLogs.push(`combatState.isActive é falso, definindo combatState como undefined.`);
      } else {
          // Garante que `combatants` seja um array e limpa cada combatente.
          if (!Array.isArray(sanitized.combatState.combatants)) {
              sanitized.combatState.combatants = [];
          }

          sanitized.combatState.combatants = sanitized.combatState.combatants.map((c: any) => {
              if (!c || typeof c !== 'object') return null; // Descarta combatentes inválidos

              // Se a IA incluiu o objeto completo do jogador, limpa para o formato esperado.
              if (c.id === 'player' || c.name === currentCharacter?.name || c.isPlayer) {
                  return {
                      id: 'player',
                      name: currentCharacter?.name || 'Player',
                      hp: c.hp || currentCharacter?.attributes?.hp,
                      ac: c.ac || currentCharacter?.attributes?.ac,
                      isPlayer: true,
                      initiative: c.initiative === null ? undefined : c.initiative,
                  };
              }
              // Para NPCs/Monstros, garanta que `initiative` não seja nulo e que o HP seja um objeto.
              const currentHp = typeof c.hp === 'object' ? c.hp.current : c.hp;
              const maxHp = typeof c.hp === 'object' ? c.hp.max : c.maxHp;
              
              return {
                  ...c,
                  hp: { current: currentHp, max: maxHp },
                  initiative: c.initiative === null ? undefined : c.initiative,
              };
          }).filter(Boolean); // Remove quaisquer entradas nulas
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

  if (sanitationLogs.length > 0) {
    const existingLog = sanitized.systemLog ? ` | ${sanitized.systemLog}` : '';
    sanitized.systemLog = `[Sanitizer Lógico] Correções: ${sanitationLogs.join(', ')}${existingLog}`;
  }

  return sanitized as GameMasterResponse;
};
