import { z } from 'zod';

export const OssMemoryFactSchema = z.object({
    fact: z.string().min(4).max(280),
    importance: z.enum(['low', 'medium', 'high']).optional(),
});

export const OssMemoryPatchSchema = z
    .object({
        newFacts: z.array(OssMemoryFactSchema).max(6).optional(),
        memoryContext: z.string().max(600).optional(),
    })
    .strict();

export type OssMemoryPatch = z.infer<typeof OssMemoryPatchSchema>;
