import { z } from 'zod';
import { OssMemoryFactSchema } from './memory.schema.js';
import { mapOssNewFactsToGameFacts } from './narration.schema.js';
import type { GameMasterResponse } from '../../schemas/gameSchemas.js';
import {
    normalizeActionOptionsFromRegistry,
    type ActionDomain,
} from '../actions/registry.js';

export const OssMinimalNarrationSchema = z
    .object({
        narration: z.string().min(1),
        tone: z.enum(['dark', 'tense', 'hopeful', 'neutral', 'epic']).optional(),
        newFacts: z.array(OssMemoryFactSchema).max(6).optional(),
        systemLog: z.string().nullable().optional(),
    })
    .strict();

export type OssMinimalNarration = z.infer<typeof OssMinimalNarrationSchema>;

export function mapMinimalToGameMasterShape(
    data: OssMinimalNarration,
    domain: ActionDomain,
): Pick<GameMasterResponse, 'logEntries' | 'actionOptions' | 'systemLog'> & {
    newFacts?: ReturnType<typeof mapOssNewFactsToGameFacts>;
} {
    const text = data.narration.trim();
    const mappedFacts = mapOssNewFactsToGameFacts(data.newFacts);
    const actionOptions = normalizeActionOptionsFromRegistry([], domain);
    return {
        logEntries: [{ type: 'narration', content: text }],
        actionOptions,
        systemLog: data.systemLog ?? null,
        ...(mappedFacts.length ? { newFacts: mappedFacts } : {}),
    };
}
