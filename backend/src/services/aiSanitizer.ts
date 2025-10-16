// backend/src/services/aiSanitizer.ts
import { GameMasterResponse } from "../schemas/gameSchemas.js";

/**
 * Sanitiza a resposta bruta do modelo para garantir:
 * 1. Nenhum campo crítico seja null.
 * 2. logEntries e newHomebrewContent sejam sempre arrays de objetos.
 * 3. Campos opcionais complexos (combatState, updatedCharacter, playerRollRequest) tenham objetos ou arrays vazios.
 * @param responseData Os dados brutos da IA.
 * @returns Um objeto GameMasterResponse que tem mais probabilidade de passar na validação Zod.
 */
export const sanitizeGameMasterResponse = (responseData: any): Partial<GameMasterResponse> => {
  if (!responseData || typeof responseData !== 'object') {
    return {};
  }
  const sanitized = { ...responseData };

  // 1. Sanitize logEntries
  if (!Array.isArray(sanitized.logEntries)) {
    sanitized.logEntries = [];
  } else {
    sanitized.logEntries = sanitized.logEntries.map((entry: any) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        try {
          const parsed = JSON.parse(entry);
          if (parsed && typeof parsed === 'object' && parsed.type && parsed.content) {
            return parsed;
          }
          // If it's a non-JSON string, wrap it.
          return { type: 'narration', content: entry };
        } catch {
          // If parsing fails, treat it as narration content.
          return { type: 'narration', content: entry };
        }
      }
      if (typeof entry === 'object' && entry.type && entry.content) {
        return entry;
      }
      return null;
    }).filter(Boolean); // Remove nulls
  }

  // 2. Sanitize newHomebrewContent
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
          return null; // Invalid JSON string
        }
      }
      return (typeof item === 'object') ? item : null;
    }).filter(Boolean); // Remove nulls
  }


  // 3. Sanitize worldState
  if (typeof sanitized.worldState === 'string') {
    try {
        sanitized.worldState = JSON.parse(sanitized.worldState);
    } catch {
        sanitized.worldState = null; // Let it be nulled to be caught by the next check
    }
  }
  if (sanitized.worldState === null || typeof sanitized.worldState !== 'object') {
    sanitized.worldState = undefined; // Use undefined to let Zod's default work
  }

  // 4. Sanitize other complex optional fields to prevent null values
  if (sanitized.combatState === null) sanitized.combatState = undefined;
  if (sanitized.playerRollRequest === null) sanitized.playerRollRequest = undefined;
  if (sanitized.updatedCharacter === null) sanitized.updatedCharacter = undefined;
  
  // 5. Ensure actionOptions is an array
  if (!Array.isArray(sanitized.actionOptions)) {
    sanitized.actionOptions = [];
  }

  return sanitized;
};
