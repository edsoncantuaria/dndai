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
          // Se o parse não resultar em um objeto válido, trata a string como narração
          return { type: 'narration', content: entry };
        } catch {
          // Se o parse falhar, trata a string como narração
          return { type: 'narration', content: entry };
        }
      }
      // Se já for um objeto, garante que tenha os campos mínimos
      if (typeof entry === 'object' && entry.type && entry.content) {
        return entry;
      }
      return null;
    }).filter(Boolean); // Remove quaisquer entradas nulas/inválidas
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
    }).filter(Boolean); // Remove quaisquer entradas nulas/inválidas
  }


  // 3. Sanitize worldState: Garante que seja um objeto
  if (typeof sanitized.worldState === 'string') {
    try {
        sanitized.worldState = JSON.parse(sanitized.worldState);
    } catch {
        sanitized.worldState = {}; // Fallback para objeto vazio
    }
  }
  if (sanitized.worldState === null || typeof sanitized.worldState !== 'object') {
    sanitized.worldState = {}; // Garante que seja sempre um objeto
  }

  // 4. Sanitize outros campos complexos opcionais para evitar null
  if (sanitized.combatState === null) sanitized.combatState = {};
  if (sanitized.playerRollRequest === null) sanitized.playerRollRequest = {};
  if (sanitized.updatedCharacter === null) sanitized.updatedCharacter = {};
  
  // 5. Garante que actionOptions seja um array
  if (!Array.isArray(sanitized.actionOptions)) {
    sanitized.actionOptions = [];
  }

  return sanitized;
};
