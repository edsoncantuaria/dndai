// backend/src/services/aiSanitizer.ts
import { GameMasterResponse } from "../schemas/gameSchemas.js";

const EMPTY_COMBAT_STATE = { isActive: false, round: 0, turn: 0, combatants: [], initiativeOrder: [] };

/**
 * Sanitiza a resposta validada da IA para garantir consistência lógica e semântica.
 * Atua como a camada final de "senso de jogo" antes de retornar a resposta.
 * @param responseData A resposta da IA, que pode conter campos nulos ou malformados.
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
      let { type = 'narration', content } = entry;
      // Trata caso onde o content é um JSON stringificado
      try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed.content === 'string') {
          content = parsed.content;
        }
      } catch (e) { /* Não é um JSON, ignora */ }
      
      content = String(content).replace(/<\/?narration>/g, '').trim();
      return content ? { type, content, rollResult: entry.rollResult } : null;
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
  
  // 3. Garante que worldState seja sempre um objeto, usando o estado anterior como fallback.
  if (!sanitized.worldState || typeof sanitized.worldState !== 'object') {
    sanitized.worldState = currentCharacter?.worldState || { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Desconhecida' };
    sanitationLogs.push('worldState era inválido, restaurado para o estado anterior ou padrão.');
  } else {
    sanitized.worldState = { ...(currentCharacter?.worldState || {}), ...sanitized.worldState };
  }

  // 4. Garante que os estados complexos sejam objetos válidos ou undefined, mas nunca null ou {}.
  const fieldsToSanitize: (keyof GameMasterResponse)[] = [
    'combatState', 'playerRollRequest', 'levelUpState', 'shopState', 'lootOffer', 'useHitDiceRequest'
  ];

  fieldsToSanitize.forEach(field => {
      if (sanitized[field] === null || (typeof sanitized[field] === 'object' && Object.keys(sanitized[field]!).length === 0)) {
           (sanitized as any)[field] = undefined;
           sanitationLogs.push(`${String(field)} era nulo ou vazio, definido como undefined.`);
      }
  });
  
  // 5. Se o combate não estiver ativo, garante que o estado do combate está ausente.
  if (sanitized.combatState && !sanitized.combatState.isActive) {
      sanitized.combatState = undefined;
      sanitationLogs.push(`combatState.isActive é falso, definindo combatState como undefined.`);
  }

  // Anexa os logs de sanitização ao systemLog para depuração.
  if (sanitationLogs.length > 0) {
    const existingLog = sanitized.systemLog ? ` | ${sanitized.systemLog}` : '';
    sanitized.systemLog = `[Sanitizer Lógico] Correções: ${sanitationLogs.join(', ')}${existingLog}`;
  }

  return sanitized as GameMasterResponse;
};
