import { z } from 'zod';

/** Efeitos sugeridos (narrativos) — motor aplica regras reais. */
export const OssEffectsSchema = z
    .object({
        state_changes: z.array(z.string().min(3).max(120)).max(8),
        systemLog: z.string().max(400).nullable().optional(),
    })
    .strict();

export type OssEffectsPatch = z.infer<typeof OssEffectsSchema>;
