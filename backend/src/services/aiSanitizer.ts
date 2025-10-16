// backend/src/services/aiSanitizer.ts
import { GameMasterResponse, HomebrewContentType } from "../schemas/gameSchemas.js";

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
    
    // Se não for um valor esperado, o frontend o exibirá como está, mas não quebrará.
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
        'ensolarado': 'Ensolarado', // Inclui o typo 'ensonarado'
        'ensonarado': 'Ensolarado',
        'nublado': 'Nublado',
        'nevoeiro': 'Nevoeiro',
    };

    for (const key in weatherMap) {
        if (lowerCaseWeather.includes(key)) {
            return weatherMap[key];
        }
    }
    
    // Se não for um valor esperado, retorna o mais próximo ou o padrão.
    const knownWeathers = ['Ensolarado', 'Nublado', 'Chuva', 'Tempestade', 'Neve', 'Nevoeiro'];
    const found = knownWeathers.find(w => lowerCaseWeather.includes(w.toLowerCase()));
    return found || 'Ensolarado';
};

const VALID_HOMEBREW_TYPES: HomebrewContentType[] = ['race', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat'];

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

  // 1. Sanitize logEntries: Garante que é um array de objetos válidos e com conteúdo.
  if (Array.isArray(sanitized.logEntries)) {
    sanitized.logEntries = sanitized.logEntries.map((entry: any) => {
      if (!entry || typeof entry !== 'object' || !entry.content) return null;
      // Trata casos onde 'content' é um JSON stringificado ou tem tags extras.
      let content = typeof entry.content === 'object' ? JSON.stringify(entry.content) : String(entry.content);
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed.content === 'string') {
          content = parsed.content;
        }
      } catch (e) { /* Não é um JSON, ignora */ }
      
      content = content.replace(/<\/?narration>/g, '').trim();
      return content ? { type: entry.type || 'narration', content, rollResult: entry.rollResult } : null;
    }).filter(Boolean);
  } else {
    sanitized.logEntries = [];
    sanitationLogs.push('logEntries não era um array, resetado para [].');
  }

  // 2. Garante que actionOptions seja um array, mesmo que vazio.
  if (!Array.isArray(sanitized.actionOptions)) {
    sanitized.actionOptions = [];
    sanitationLogs.push('actionOptions não era um array, resetado para [].');
  }
  
  // 3. Garante que worldState seja sempre um objeto e normaliza seus campos.
  if (!sanitized.worldState || typeof sanitized.worldState !== 'object' || Object.keys(sanitized.worldState).length === 0) {
    sanitized.worldState = currentCharacter?.worldState || { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Desconhecida' };
    sanitationLogs.push('worldState era inválido, restaurado para o estado anterior ou padrão.');
  } else {
    // Merge para não perder dados e normaliza os valores.
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

  // 4. Se o combate não estiver ativo, garante que o estado do combate está ausente para evitar confusão na UI.
  if (sanitized.combatState && !sanitized.combatState.isActive) {
      sanitized.combatState = undefined;
      sanitationLogs.push(`combatState.isActive é falso, definindo combatState como undefined.`);
  }
  
  // 5. Sanitize newHomebrewContent to fix common AI mistakes.
  if (Array.isArray(sanitized.newHomebrewContent)) {
    sanitized.newHomebrewContent = sanitized.newHomebrewContent.map((item: any) => {
      if (!item || typeof item !== 'object' || !item.type) return item;
      
      // FIX: AI often uses the monster's type (e.g., "Construct") as the homebrew content type.
      // If the type is invalid but it has monster fields, correct it to "monster".
      if (!VALID_HOMEBREW_TYPES.includes(item.type) && (item.armor_class || item.hit_points || item.actions)) {
          sanitationLogs.push(`Corrigido tipo de homebrew inválido '${item.type}' para 'monster' para o item '${item.name}'.`);
          item.type = 'monster';
      }
      return item;
    });
  }


  // 6. Garante que os outros estados complexos sejam objetos válidos ou undefined, mas nunca null.
  const fieldsToMakeUndefinedIfEmpty: (keyof GameMasterResponse)[] = [
    'playerRollRequest', 'levelUpState', 'shopState', 'lootOffer', 'useHitDiceRequest'
  ];

  fieldsToMakeUndefinedIfEmpty.forEach(field => {
      if (sanitized[field] === null || (typeof sanitized[field] === 'object' && Object.keys(sanitized[field]!).length === 0)) {
           (sanitized as any)[field] = undefined;
           sanitationLogs.push(`${String(field)} era nulo ou vazio, definido como undefined.`);
      }
  });

  // Anexa os logs de sanitização ao systemLog para depuração.
  if (sanitationLogs.length > 0) {
    const existingLog = sanitized.systemLog ? ` | ${sanitized.systemLog}` : '';
    sanitized.systemLog = `[Sanitizer Lógico] Correções: ${sanitationLogs.join(', ')}${existingLog}`;
  }

  return sanitized as GameMasterResponse;
};
