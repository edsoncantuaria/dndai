import { z } from 'zod';

export const npcGoalSchema = z.object({
    id: z.string().min(1).max(64),
    description: z.string().min(3).max(240),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    status: z.enum(['active', 'completed', 'failed']).default('active'),
});

export const npcPersonalitySchema = z.object({
    traits: z.array(z.string().max(80)).max(8).default([]),
    goals: z.array(npcGoalSchema).max(6).default([]),
    routine: z.string().max(200).optional(),
    voiceTone: z.string().max(80).optional(),
});

export type NpcPersonality = z.infer<typeof npcPersonalitySchema>;

export function parseNpcPersonality(raw: unknown): NpcPersonality {
    const parsed = npcPersonalitySchema.safeParse(raw ?? {});
    if (parsed.success) return parsed.data;
    return { traits: [], goals: [] };
}
