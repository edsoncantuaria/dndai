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

  // 1. Sanitize logEntries: Ensure it's an array of valid objects.
  if (!Array.isArray(sanitized.logEntries)) {
    sanitized.logEntries = [];
    sanitationLogs.push('logEntries was not an array.');
  } else {
    sanitized.logEntries = sanitized.logEntries.map((entry: any) => {
      if (!entry) return null;

      if (typeof entry === 'string') {
        try {
          const parsed = JSON.parse(entry);
          if (parsed && typeof parsed === 'object' && parsed.type && parsed.content) {
            return parsed;
          }
          if (entry.trim()) return { type: 'narration', content: entry };
        } catch {
          if (entry.trim() && !['type', 'narration', 'content'].includes(entry)) {
            return { type: 'narration', content: entry };
          }
        }
      }
      if (typeof entry === 'object' && entry.type && entry.content) {
        return entry;
      }
      return null;
    }).filter((entry): entry is Exclude<typeof entry, null> => entry !== null);
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

  // 3. Ensure complex optional fields are undefined if null, allowing Zod defaults to work.
  const fieldsToSanitize: (keyof GameMasterResponse)[] = [
    'worldState', 'combatState', 'playerRollRequest', 'updatedCharacter', 'levelUpState', 'shopState', 'lootOffer', 'useHitDiceRequest'
  ];

  fieldsToSanitize.forEach(field => {
      if (sanitized[field] === null) {
          sanitized[field] = undefined;
          sanitationLogs.push(`${field} was null, set to undefined.`);
      } else if (typeof sanitized[field] === 'string') {
          try {
              const parsed = JSON.parse(sanitized[field] as string);
              sanitized[field] = parsed;
              sanitationLogs.push(`Parsed JSON string for ${field}.`);
          } catch {
             sanitized[field] = undefined; // Set to undefined if parsing fails
             sanitationLogs.push(`Failed to parse JSON string for ${field}, set to undefined.`);
          }
      }
  });

  // 4. Ensure actionOptions is an array.
  if (!Array.isArray(sanitized.actionOptions)) {
    sanitized.actionOptions = [];
     sanitationLogs.push('actionOptions fallback applied.');
  }

  // Append sanitation logs to the system log for debugging.
  if (sanitationLogs.length > 0) {
    const existingLog = sanitized.systemLog ? ` | ${sanitized.systemLog}` : '';
    sanitized.systemLog = `[Sanitizer] Applied corrections: ${sanitationLogs.join(', ')}${existingLog}`;
  }


  return sanitized;
};
