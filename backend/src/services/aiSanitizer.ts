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

  // 1. Sanitize logEntries: Garante que é um array de objetos válidos.
  if (Array.isArray(sanitized.logEntries)) {
    sanitized.logEntries = sanitized.logEntries.map((entry: any) => {
      if (!entry) return null;
      
      let content = entry;
      let type = 'narration'; // Tipo padrão

      if (typeof entry === 'object' && entry !== null) {
        content = entry.content;
        type = entry.type || 'narration';
      }

      // Remove tags XML como <narration>
      if (typeof content === 'string') {
        content = content.replace(/<\/?narration>/g, '').trim();
      }

      // Se o conteúdo for um JSON stringificado dentro de um logEntry, faz o parse.
      if (typeof content === 'string' && content.startsWith('{') && content.endsWith('}')) {
          try {
            return JSON.parse(content);
          } catch {
            // Se o parse falhar, trata como string normal.
          }
      }

      return { type, content };
    }).filter((entry): entry is Exclude<typeof entry, null> => entry !== null && entry.content && (typeof entry.content !== 'string' || entry.content.trim() !== ''));
  } else {
    sanitized.logEntries = [];
    sanitationLogs.push('logEntries não era um array, foi resetado para [].');
  }
  
  // 2. Sanitize newHomebrewContent
  if (Array.isArray(sanitized.newHomebrewContent)) {
      sanitized.newHomebrewContent = sanitized.newHomebrewContent.filter((item: any) => item && typeof item === 'object');
  } else {
    sanitized.newHomebrewContent = [];
  }

  // 3. Garante que campos de objeto complexos sejam 'undefined' se forem nulos ou não forem objetos.
  // Isso permite que os valores padrão do Zod ou a validação 'optional' funcionem corretamente.
  const fieldsToSanitize: (keyof GameMasterResponse)[] = [
    'worldState', 'combatState', 'playerRollRequest', 'updatedCharacter', 'levelUpState', 'shopState', 'lootOffer', 'useHitDiceRequest'
  ];

  fieldsToSanitize.forEach(field => {
      if (sanitized[field] === null || (typeof sanitized[field] === 'object' && Object.keys(sanitized[field]!).length === 0)) {
           sanitized[field] = undefined;
           sanitationLogs.push(`${field} era nulo ou vazio, definido como undefined.`);
      }
  });

  // 4. Garante que actionOptions seja um array.
  if (!Array.isArray(sanitized.actionOptions)) {
    sanitized.actionOptions = [];
     sanitationLogs.push('actionOptions não era um array, foi resetado para [].');
  }

  // Anexa os logs de sanitização ao systemLog para depuração.
  if (sanitationLogs.length > 0) {
    const existingLog = sanitized.systemLog ? ` | ${sanitized.systemLog}` : '';
    sanitized.systemLog = `[Sanitizer] Correções aplicadas: ${sanitationLogs.join(', ')}${existingLog}`;
  }

  return sanitized;
};
