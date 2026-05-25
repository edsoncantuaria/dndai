import type { z } from 'zod';
import { GenerationConfigSchema } from '../../schemas/validationSchemas.js';

type GenerationConfig = z.infer<typeof GenerationConfigSchema>;

/** Combate — temperatura baixa, respostas curtas e consistentes. */
export const OSS_COMBAT_CONFIG: GenerationConfig = {
    temperature: 0.55,
    topP: 0.85,
    topK: 32,
    maxOutputTokens: 1536,
};
