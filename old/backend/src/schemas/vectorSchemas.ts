// backend/src/schemas/vectorSchemas.ts
import { z } from 'zod';

export const MemoryPayloadSchema = z.object({
    id: z.string(),
    type: z.string(),
    sessionId: z.string().optional(),
    nodeId: z.string().optional(),
    name: z.string().optional(),
    timestamp: z.number().default(() => Date.now()),
    turn: z.number().optional(),
    summary: z.string().optional(),
    text: z.string().optional(),
}).passthrough();

export type MemoryPayload = z.infer<typeof MemoryPayloadSchema>;
