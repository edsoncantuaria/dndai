// backend/src/services/aiSanitizer.ts
import { GameMasterResponse } from "../schemas/gameSchemas.js";

/**
 * Sanitiza a resposta bruta do modelo para garantir:
 * 1. Nenhum campo crítico seja null.
 * 2. logEntries e newHomebrewContent sejam sempre arrays de objetos válidos.
 * 3. Campos opcionais complexos (combatState, updatedCharacter, playerRollRequest) tenham valores padrão seguros se forem nulos.
 * @param responseData Os dados brutos da IA.
 * @returns Um objeto GameMasterResponse que tem mais probabilidade de passar na validação Zod.
 */
export const sanitizeGameMasterResponse = (responseData: any): Partial<GameMasterResponse> => {
  if (!responseData || typeof responseData !== 'object') {
    return {};
  }
  const sanitized = { ...responseData };

  // 1. Sanitize logEntries: Garante que seja um array de objetos válidos.
  if (!Array.isArray(sanitized.logEntries)) {
    sanitized.logEntries = [];
  } else {
    sanitized.logEntries = sanitized.logEntries.map((entry: any) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        try {
          const parsed = JSON.parse(entry);
          // Certifica-se de que o objeto parseado tenha a estrutura mínima
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
      return null;
    }).filter((entry): entry is Exclude<typeof entry, null> => entry !== null); // Filtra quaisquer entradas nulas/inválidas
  }


  // 2. Sanitize newHomebrewContent: Garante que seja um array de objetos válidos.
   if (!Array.isArray(sanitized.newHomebrewContent)) {
    sanitized.newHomebrewContent = [];
  } else {
    sanitized.newHomebrewContent = sanitized.newHomebrewContent.map((item: any) => {
      if (!item) return null;
      if (typeof item === 'string') {
        try {
          const parsed = JSON.parse(item);
          return (parsed && typeof parsed === 'object') ? parsed : null;
        } catch {
          return null; // Descarta JSON string inválida
        }
      }
      return (typeof item === 'object') ? item : null;
    }).filter((item): item is Exclude<typeof item, null> => item !== null);
  }


  // 3. Garante que campos complexos opcionais não sejam `null`.
  // Se forem nulos, Zod usará o `default` ou `optional` definido no schema.
  if (sanitized.worldState === null) sanitized.worldState = undefined;
  if (sanitized.combatState === null) sanitized.combatState = undefined;
  if (sanitized.playerRollRequest === null) sanitized.playerRollRequest = undefined;
  if (sanitized.updatedCharacter === null) sanitized.updatedCharacter = undefined;
  if (sanitized.levelUpState === null) sanitized.levelUpState = undefined;
  if (sanitized.shopState === null) sanitized.shopState = undefined;

   // Se worldState ou combatState forem strings, tenta fazer o parse.
    if (typeof sanitized.worldState === 'string') {
        try {
            sanitized.worldState = JSON.parse(sanitized.worldState);
        } catch {
            sanitized.worldState = undefined; // Deixa Zod usar o default
        }
    }
    if (typeof sanitized.combatState === 'string') {
        try {
            sanitized.combatState = JSON.parse(sanitized.combatState);
        } catch {
            sanitized.combatState = undefined; // Deixa Zod usar o default
        }
    }


  // 4. Garante que actionOptions seja um array
  if (!Array.isArray(sanitized.actionOptions)) {
    sanitized.actionOptions = [];
  }

  return sanitized;
};
