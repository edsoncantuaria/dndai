/**
 * @deprecated Fachada legada — use `ai-oss/orchestration/narrationPipeline.ts` com AI_ENGINE=oss.
 * Implementação ainda em aiService.ts até Fase 2 (TODO-OSS-120B.md).
 */
export {
    getGameUpdate,
    setGameUpdateOverride,
    type GameUpdateResult,
    type GameUpdateWarning,
} from '../services/aiService.js';
