import { z } from 'zod';
import { CombatStateSchema } from './gameSchemas.js';

export const CURRENT_CONTRACT_VERSION = 1;

export const ProcessActionSchema = z.object({
    contractVersion: z.number().int().positive().optional(),
    sessionId: z.number().int().positive().optional(),
    prompt: z.string().min(1).optional(),
    intent: z
        .object({
            type: z.string(),
            payload: z.record(z.any()),
        })
        .nullable()
        .optional(),
    combatState: CombatStateSchema.nullable().optional(),
    apiKey: z.string().optional(),
    useAiHomebrew: z.boolean().optional(),
    model: z.string().optional(),
    clientStateVersion: z.number().optional(),
    actionId: z.string().optional(),
    clientInstanceId: z.string().trim().min(8).max(64).optional(),
    actionCursor: z.number().int().nonnegative().optional(),
    narrationVoice: z.enum(['faber', 'razo', 'miro', 'dii']).optional(),
    narrationSpeed: z.enum(['rapido', 'normal', 'lento', 'pausado']).optional(),
});

export type ProcessActionPayload = z.infer<typeof ProcessActionSchema>;

export const isContractVersionSupported = (version?: number | null) => {
    if (version == null) return true;
    return version === CURRENT_CONTRACT_VERSION;
};
