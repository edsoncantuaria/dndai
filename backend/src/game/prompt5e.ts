// backend/src/game/prompt5e.ts
import { regrasBase } from './prompts/regrasBase.js';
import { regrasCombate } from './prompts/regrasCombate.js';
import { regrasInventario } from './prompts/regrasInventario.js';

/**
 * Monta o prompt completo para o Mestre de Jogo de D&D 5e,
 * combinando os módulos de regras importados.
 * Isso melhora a organização e a manutenibilidade do prompt.
 */
export const promptDnD5e = `
${regrasBase}

${regrasInventario}

${regrasCombate}
`;
