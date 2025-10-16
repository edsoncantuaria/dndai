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
  if(responseData.combatState === null) responseData.combatState = undefined;
  if(responseData.updatedCharacter === null) responseData.updatedCharacter = undefined;
  if(responseData.playerRollRequest === null) responseData.playerRollRequest = undefined;
  
  // 3. Garante que newHomebrewContent seja um array de objetos
  if (!Array.isArray(responseData.newHomebrewContent)) {
    responseData.newHomebrewContent = [];
  }
  
  responseData.newHomebrewContent = responseData.newHomebrewContent.map((item: any) => {
    if (!item) return undefined; // remove null/undefined
    if (typeof item === 'string') {
      try {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object') return parsed;
        return undefined; // A string não era um objeto JSON válido
      } catch {
        return undefined; // Falha no parse
      }
    }
    if (typeof item === 'object') return item;
    return undefined; // Descarta tipos inesperados
  }).filter(Boolean); // Limpa os undefineds do array


  if (typeof responseData.worldState === 'string') {
    try {
        responseData.worldState = JSON.parse(responseData.worldState);
    } catch {
        responseData.worldState = null; 
    }
  }
  
  if (responseData.worldState === null || typeof responseData.worldState !== 'object') {
     responseData.worldState = undefined;
  }

  // Garante que os estados de jogo sejam nulos ou objetos, nunca strings
  if(responseData.levelUpState === null) responseData.levelUpState = undefined;
  if(responseData.shopState === null) responseData.shopState = undefined;
  if(responseData.lootOffer === null) responseData.lootOffer = undefined;
  if(responseData.useHitDiceRequest === null) responseData.useHitDiceRequest = undefined;


  return responseData as GameMasterResponse;
};
