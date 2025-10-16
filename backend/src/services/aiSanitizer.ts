// backend/src/services/aiSanitizer.ts
import { GameMasterResponse } from "../schemas/gameSchemas.js";

/**
 * Sanitiza a resposta bruta do modelo para garantir que ela esteja em conformidade com o schema esperado,
 * corrigindo erros comuns de formatação da IA.
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
  if (Array.isArray(sanitized.logEntries)) {
    sanitized.logEntries = sanitized.logEntries.map((entry: any) => {
      if (!entry) return null;

      let content = entry;
      let type = 'narration'; // Default type

      if (typeof entry === 'object' && entry !== null) {
        content = entry.content;
        type = entry.type || 'narration';
      }

      if (typeof content === 'string') {
        // Remove XML-like tags, e.g., <narration>
        content = content.replace(/<\/?narration>/g, '').trim();
        // Check if the string is a JSON object string
        if (content.startsWith('{') && content.endsWith('}')) {
          try {
            return JSON.parse(content);
          } catch {
            // It's not a valid JSON, so treat it as a narration string
          }
        }
        return { type, content };
      }
      return null;
    }).filter((entry): entry is Exclude<typeof entry, null> => entry !== null && entry.content.trim() !== '');
  } else {
    sanitized.logEntries = [];
    sanitationLogs.push('logEntries was not an array.');
  }
  
  // 2. Sanitize newHomebrewContent
  if (Array.isArray(sanitized.newHomebrewContent)) {
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
  } else {
    sanitized.newHomebrewContent = [];
  }

  // 3. Ensure complex optional fields are undefined if null or not objects, allowing Zod defaults to work.
  const fieldsToSanitize: (keyof GameMasterResponse)[] = [
    'worldState', 'combatState', 'playerRollRequest', 'updatedCharacter', 'levelUpState', 'shopState', 'lootOffer', 'useHitDiceRequest'
  ];

  fieldsToSanitize.forEach(field => {
      if (sanitized[field] === null || typeof sanitized[field] !== 'object') {
          if (sanitized[field] !== undefined) {
             sanitationLogs.push(`${field} was ${sanitized[field] === null ? 'null' : 'not an object'}, set to undefined.`);
          }
          sanitized[field] = undefined;
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
