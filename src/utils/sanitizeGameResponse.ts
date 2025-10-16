// src/utils/sanitizeGameResponse.ts
import type { GameMasterResponse } from '../types';

const EMPTY_COMBAT_STATE = { isActive: false, round: 0, turn: 0, combatants: [], initiativeOrder: [] };

/**
 * Sanitizes the raw response from the AI to ensure it's safe for the frontend state.
 * It provides default, safe values for fields that might be null or malformed.
 * This function acts as a defensive layer to prevent the UI from crashing due to unexpected AI output.
 * @param response The raw response object from the backend.
 * @returns A sanitized GameMasterResponse object.
 */
export const sanitizeGameMasterResponse = (response: any): GameMasterResponse => {
    if (typeof response !== 'object' || response === null) {
        return {
            logEntries: [{ type: 'system', content: 'A resposta do mestre foi inválida.' }],
            actionOptions: [],
            combatState: EMPTY_COMBAT_STATE,
        };
    }

    const logEntries = Array.isArray(response.logEntries)
        ? response.logEntries.map((entry: any) => {
              if (typeof entry === 'string') {
                  return { type: 'narration', content: entry };
              }
              if (typeof entry === 'object' && entry !== null && entry.type && entry.content) {
                  return entry;
              }
              return null;
          }).filter(Boolean)
        : [];
    
    return {
        logEntries: logEntries,
        actionOptions: Array.isArray(response.actionOptions) ? response.actionOptions : [],
        updatedCharacter: response.updatedCharacter ?? undefined,
        worldState: typeof response.worldState === 'object' && response.worldState !== null ? response.worldState : undefined,
        combatState: typeof response.combatState === 'object' && response.combatState !== null ? response.combatState : EMPTY_COMBAT_STATE,
        playerRollRequest: typeof response.playerRollRequest === 'object' && response.playerRollRequest !== null ? response.playerRollRequest : undefined,
        levelUpState: typeof response.levelUpState === 'object' && response.levelUpState !== null ? response.levelUpState : undefined,
        shopState: typeof response.shopState === 'object' && response.shopState !== null ? response.shopState : undefined,
        lootOffer: typeof response.lootOffer === 'object' && response.lootOffer !== null ? response.lootOffer : undefined,
        useHitDiceRequest: typeof response.useHitDiceRequest === 'object' && response.useHitDiceRequest !== null ? response.useHitDiceRequest : undefined,
        ambientSound: response.ambientSound ?? 'none',
        systemLog: response.systemLog ?? undefined,
    };
};
