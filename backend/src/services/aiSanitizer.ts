// backend/src/services/aiSanitizer.ts
import { GameMasterResponse } from "../schemas/gameSchemas.js";

/**
 * Sanitiza a resposta bruta do modelo para garantir que ela esteja em conformidade com o schema esperado,
 * corrigindo erros comuns de formatação da IA, como strings JSON encapsuladas, valores nulos e objetos incompletos.
 * @param responseData Os dados brutos da IA.
 * @returns Um objeto GameMasterResponse que tem mais probabilidade de passar na validação Zod.
 */
export const sanitizeGameMasterResponse = (responseData: any): Partial<GameMasterResponse> => {
  if (!responseData || typeof responseData !== 'object') {
    return {};
  }
  
  const sanitized: Partial<GameMasterResponse> & { systemLog?: string | null } = { ...responseData };
  const sanitationLogs: string[] = [];

  // 1. Sanitize logEntries: Garante que seja um array de objetos válidos.
  if (!Array.isArray(sanitized.logEntries)) {
    sanitized.logEntries = [];
    sanitationLogs.push('logEntries was not an array.');
  } else {
    sanitized.logEntries = sanitized.logEntries.map((entry: any) => {
      if (!entry) return null; // Será filtrado no final

      // Se for uma string, tenta fazer o parse, se falhar, trata como narração.
      if (typeof entry === 'string') {
        try {
          const parsed = JSON.parse(entry);
          // Se o parse resultar em um objeto válido, use-o.
          if (parsed && typeof parsed === 'object' && parsed.type && parsed.content) {
            return parsed;
          }
           // Se o parse não resultar em um objeto válido, mas a string tem conteúdo, trata como narração
          if(entry.trim()) return { type: 'narration', content: entry };
        } catch {
          // Se o parse falhar, mas a string tem conteúdo, trata como narração
          if(entry.trim()) return { type: 'narration', content: entry };
        }
      }
      // Se já for um objeto, garante que tenha os campos mínimos
      if (typeof entry === 'object' && entry.type && entry.content) {
        return entry;
      }
      // Se for um objeto incompleto ou de formato inesperado
      return null;
    }).filter((entry): entry is Exclude<typeof entry, null> => entry !== null); // Filtra quaisquer entradas nulas/inválidas
  }
  
  // 2. Sanitize newHomebrewContent
  if (!Array.isArray(sanitized.newHomebrewContent)) {
    sanitized.newHomebrewContent = [];
    sanitationLogs.push('newHomebrewContent was not an array.');
  } else {
    sanitized.newHomebrewContent = sanitized.newHomebrewContent.map((item: any) => {
      if (!item) return null;
      if (typeof item === 'string') {
        try {
          const parsed = JSON.parse(item);
          return (parsed && typeof parsed === 'object') ? parsed : null;
        } catch { return null; }
      }
      return (typeof item === 'object') ? item : null;
    }).filter((item): item is Exclude<typeof item, null> => item !== null);
  }

  // 3. Garante que campos complexos opcionais não sejam `null`, usando objetos vazios como fallback seguro.
  if (sanitized.worldState === null || typeof sanitized.worldState !== 'object') {
    sanitized.worldState = {};
    sanitationLogs.push('worldState fallback applied.');
  }
  if (sanitized.combatState === null || typeof sanitized.combatState !== 'object') {
    sanitized.combatState = {}; // Zod default irá preencher isso
    sanitationLogs.push('combatState fallback applied.');
  }
  if (sanitized.playerRollRequest === null || typeof sanitized.playerRollRequest !== 'object') {
    sanitized.playerRollRequest = {}; // Zod default irá preencher isso
    sanitationLogs.push('playerRollRequest fallback applied.');
  }
  if (sanitized.updatedCharacter === null || typeof sanitized.updatedCharacter !== 'object') {
    sanitized.updatedCharacter = {};
    sanitationLogs.push('updatedCharacter fallback applied.');
  }
  
  // 4. Garante que actionOptions seja um array.
  if (!Array.isArray(sanitized.actionOptions)) {
    sanitized.actionOptions = [];
     sanitationLogs.push('actionOptions fallback applied.');
  }

  // Anexa logs de sanitização ao log do sistema para depuração.
  if (sanitationLogs.length > 0) {
    const existingLog = sanitized.systemLog ? ` | ${sanitized.systemLog}` : '';
    sanitized.systemLog = `[Sanitizer] Applied fallbacks for: ${sanitationLogs.join(', ')}${existingLog}`;
  }


  return sanitized;
};
