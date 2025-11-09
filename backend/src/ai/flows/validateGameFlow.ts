// backend/src/ai/flows/validateGameFlow.ts
import { z } from 'zod';
import { GameMasterResponseSchema } from '../../schemas/gameSchemas.js';
import { runGmValidator } from '../../services/gmValidator.js';

export const ValidateGameFlowInputSchema = z.object({
    response: GameMasterResponseSchema,
    context: z
        .object({
            memorySummary: z.string().optional(),
            memoryReferences: z.array(z.string()).optional(),
            gameClock: z
                .object({
                    day: z.number().int().nonnegative().optional(),
                    hour: z.number().int().min(0).max(23).optional(),
                    weather: z.string().optional(),
                })
                .optional(),
        })
        .optional(),
});

export const ValidateGameFlowOutputSchema = z.object({
    validatedResponse: GameMasterResponseSchema,
    issues: z.array(
        z.object({
            path: z.string(),
            problem: z.string(),
            fixed: z.boolean(),
        })
    ),
});

export const validateGameFlow = async (input: z.infer<typeof ValidateGameFlowInputSchema>) => {
    const context = input.context ?? {};
    const result = runGmValidator(input.response, context);
    return ValidateGameFlowOutputSchema.parse(result);
};
