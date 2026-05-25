import type { z } from 'zod';
import { GenerationConfigSchema } from '../../schemas/validationSchemas.js';

type GenerationConfig = z.infer<typeof GenerationConfigSchema>;

/** Narração livre — mais criativa, JSON compacto. */
export const OSS_NARRATIVE_CONFIG: GenerationConfig = {
    temperature: 0.78,
    topP: 0.9,
    topK: 48,
    maxOutputTokens: 2048,
};
