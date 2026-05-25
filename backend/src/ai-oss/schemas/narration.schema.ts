import { z } from 'zod';
import { OssMemoryFactSchema } from './memory.schema.js';
import type { NewFact } from '../../schemas/memorySchemas.js';

/** Schema compacto — fase narrativa OSS (mapeado depois para GameMasterResponse). */
const LogEntrySchema = z.object({
    type: z.enum(['narration', 'action', 'system', 'combat', 'insight', 'roll']),
    content: z.union([
        z.string(),
        z.object({
            content: z.string().optional(),
            text: z.string().optional(),
        }),
    ]),
});

const ActionOptionSchema = z.union([
    z.string(),
    z.object({
        text: z.string(),
        action: z.string(),
        skill: z.string().optional(),
    }),
]);

export const OssNarrationResponseSchema = z
    .object({
        narration: z.string().optional(),
        logEntries: z.array(LogEntrySchema).min(1).optional(),
        actionOptions: z.array(ActionOptionSchema).min(1).max(8),
        systemLog: z.string().nullable().optional(),
        state_changes: z.array(z.string()).max(12).optional(),
        newFacts: z.array(OssMemoryFactSchema).min(0).max(6).optional(),
    })
    .strict()
    .refine(
        data => Boolean(data.narration?.trim()) || (data.logEntries && data.logEntries.length > 0),
        { message: 'Informe narration ou logEntries com ao menos uma entrada.' },
    );

export type OssNarrationResponse = z.infer<typeof OssNarrationResponseSchema>;

/** Converte resposta compacta → formato legado mínimo para o motor. */
/** Converte fatos OSS (texto + importance) → fatos SQL do jogo. */
export function mapOssNewFactsToGameFacts(
    facts: OssNarrationResponse['newFacts'],
): NewFact[] {
    if (!facts?.length) return [];
    return facts
        .map(raw => {
            const text = raw.fact?.trim();
            if (!text || text.length < 3) return null;
            return {
                category: 'general' as const,
                fact: text.slice(0, 500),
                subject:
                    raw.importance === 'high'
                        ? 'importante'
                        : raw.importance === 'medium'
                          ? 'relevante'
                          : undefined,
            } satisfies NewFact;
        })
        .filter((f): f is NewFact => f !== null)
        .slice(0, 6);
}

export function mapOssNarrationToGameMasterShape(data: OssNarrationResponse): {
    logEntries: Array<{ type: 'narration'; content: string }>;
    actionOptions: OssNarrationResponse['actionOptions'];
    systemLog?: string | null;
    newFacts?: NewFact[];
} {
    if (data.logEntries?.length) {
        const mappedFacts = mapOssNewFactsToGameFacts(data.newFacts);
        return {
            logEntries: data.logEntries.map(entry => ({
                type: (entry.type === 'narration' ? 'narration' : entry.type) as 'narration',
                content:
                    typeof entry.content === 'string'
                        ? entry.content
                        : entry.content?.content ?? entry.content?.text ?? '',
            })),
            actionOptions: data.actionOptions,
            systemLog: data.systemLog ?? null,
            ...(mappedFacts.length ? { newFacts: mappedFacts } : {}),
        };
    }
    const text = data.narration?.trim() ?? '';
    const mappedFacts = mapOssNewFactsToGameFacts(data.newFacts);
    return {
        logEntries: [{ type: 'narration', content: text }],
        actionOptions: data.actionOptions,
        systemLog: data.systemLog ?? null,
        ...(mappedFacts.length ? { newFacts: mappedFacts } : {}),
    };
}
