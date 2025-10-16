// backend/src/services/aiSanitizer.ts
import { GameMasterResponse } from "../schemas/gameSchemas.js";

/**
 * Sanitiza a resposta bruta do modelo para garantir:
 * 1. Nenhum campo crítico seja null.
 * 2. logEntries seja sempre um array de objetos { type, content }.
 * 3. Campos opcionais complexos (combatState, updatedCharacter, playerRollRequest, newHomebrewContent) tenham objetos ou arrays vazios.
 */
export const sanitizeGameMasterResponse = (responseData: any): GameMasterResponse => {

  // 1. logEntries sempre como array de objetos
  if (!Array.isArray(responseData.logEntries)) {
    responseData.logEntries = [];
  }

  responseData.logEntries = responseData.logEntries.map((entry: any) => {
    // Se for string, tenta fazer o parse. Se falhar, trata como narração.
    if (typeof entry === 'string') {
        try {
            const parsed = JSON.parse(entry);
            // Se o parse resultar em um objeto válido com 'type' e 'content', use-o.
            if (parsed && typeof parsed === 'object' && parsed.type && parsed.content) {
                return parsed;
            }
            // Se não, usa a string original como conteúdo de narração.
            return { type: "narration", content: entry };
        } catch {
            // Se o parse falhar, trata a string como conteúdo de narração.
            return { type: "narration", content: entry };
        }
    }

    // Se for null ou não objeto, transforma em narração genérica
    if (!entry || typeof entry !== "object") {
      return { type: "system", content: "A IA enviou uma entrada de log inválida." };
    }

    // Preenche defaults para objetos incompletos
    return {
      type: entry.type || "narration",
      content: entry.content || "A IA enviou uma narração vazia.",
      ...entry // mantém campos extras caso existam
    };
  }).filter(Boolean); // Remove quaisquer entradas que resultaram em 'null'

  // 2. Campos opcionais complexos não podem ser null
  responseData.combatState ??= {};
  responseData.updatedCharacter ??= {};
  responseData.playerRollRequest ??= null; // playerRollRequest PODE ser null
  responseData.newHomebrewContent ??= [];

  // 3. worldState sempre como objeto
  responseData.worldState ??= {};

  // 4. actionOptions sempre como array
  if (!Array.isArray(responseData.actionOptions)) {
    responseData.actionOptions = [];
  } else {
    // Filtra quaisquer valores nulos/falsos que a IA possa ter colocado no array
    responseData.actionOptions = responseData.actionOptions.filter(Boolean);
  }

  // 5. systemLog sempre como string ou null
  responseData.systemLog = (typeof responseData.systemLog === 'string') ? responseData.systemLog : null;
  
  // Garante que os estados de jogo sejam nulos ou objetos, nunca strings
  responseData.levelUpState ??= null;
  responseData.shopState ??= null;
  responseData.lootOffer ??= null;
  responseData.useHitDiceRequest ??= null;


  return responseData as GameMasterResponse;
};
