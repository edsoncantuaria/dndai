/**
 * Fachada pública do cliente Gemini para o pipeline de jogo (Fase 11).
 * Implementação permanece em aiService até migração completa de runGameUpdate.
 */
export {
    getGameUpdate,
    setGameUpdateOverride,
    type GameUpdateResult,
    type GameUpdateWarning,
} from '../services/aiService.js';
