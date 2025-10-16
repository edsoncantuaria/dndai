// backend/src/services/aiSanitizer.ts
import { GameMasterResponse } from "../schemas/gameSchemas.js";

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
  
  // 3. Garante que worldState seja sempre um objeto, usando o estado anterior como fallback.
  if (!sanitized.worldState || typeof sanitized.worldState !== 'object' || Object.keys(sanitized.worldState).length === 0) {
    sanitized.worldState = currentCharacter?.worldState || { timeOfDay: 'Manhã', weather: 'Ensolarado', currentRegion: 'Desconhecida' };
    sanitationLogs.push('worldState era inválido, restaurado para o estado anterior ou padrão.');
  } else {
    // Merge para não perder dados
    sanitized.worldState = { ...(currentCharacter?.worldState || {}), ...sanitized.worldState };
  }

  // 4. Se o combate não estiver ativo, garante que o estado do combate está ausente para evitar confusão na UI.
  if (sanitized.combatState && !sanitized.combatState.isActive) {
      sanitized.combatState = undefined;
      sanitationLogs.push(`combatState.isActive é falso, definindo combatState como undefined.`);
  }

  // 5. Garante que os outros estados complexos sejam objetos válidos ou undefined, mas nunca null.
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
