import { z } from 'zod';

const compareOpSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);

export const triggerConditionSchema = z.object({
    path: z.string().min(1),
    op: compareOpSchema,
    value: z.union([z.string(), z.number(), z.boolean()]),
});

export const triggerWhenSchema = z.object({
    all: z.array(triggerConditionSchema).min(1),
});

export const triggerOnceSchema = z.object({
    perSession: z.boolean().default(true),
});

export const triggerActionSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('startQuest'),
        questSlug: z.string().min(1),
        title: z.string().min(1),
        payload: z.record(z.unknown()).optional(),
    }),
    z.object({
        action: z.literal('schedulePulse'),
        trigger: z.enum(['travel', 'long-rest', 'manual', 'combat_end', 'quest_major', 'game_day']),
    }),
    z.object({
        action: z.literal('setShardPolitics'),
        state: z.enum(['stable', 'tense', 'coup_risk']),
    }),
    z.object({
        action: z.literal('recordFact'),
        text: z.string().min(3),
    }),
]);

export const narrativeTriggerRuleSchema = z.object({
    id: z.string().min(1).max(64),
    on: z.array(z.string().min(1)).min(1),
    when: triggerWhenSchema,
    once: triggerOnceSchema.optional(),
    then: z.array(triggerActionSchema).min(1),
});

export const narrativeTriggerCatalogSchema = z.array(narrativeTriggerRuleSchema);

export type TriggerCondition = z.infer<typeof triggerConditionSchema>;
export type TriggerWhen = z.infer<typeof triggerWhenSchema>;
export type TriggerAction = z.infer<typeof triggerActionSchema>;
export type NarrativeTriggerRule = z.infer<typeof narrativeTriggerRuleSchema>;
