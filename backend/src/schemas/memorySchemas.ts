import { z } from 'zod';

export const NewFactSchema = z.object({
    category: z.enum(['region', 'npc', 'quest', 'general']),
    subject: z.string().min(1).max(120).optional(),
    fact: z.string().min(3).max(500),
    regionSlug: z.string().min(1).max(120).optional(),
    npcId: z.string().min(1).max(120).optional(),
    questId: z.string().min(1).max(120).optional(),
});

export type NewFact = z.infer<typeof NewFactSchema>;

export const NewFactsArraySchema = z.array(NewFactSchema).max(8);
