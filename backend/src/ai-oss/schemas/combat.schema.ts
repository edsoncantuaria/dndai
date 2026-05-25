import { z } from 'zod';
import {
    OssNarrationResponseSchema,
    mapOssNarrationToGameMasterShape,
} from './narration.schema.js';

const MAX_COMBAT_NARRATION_CHARS = 900;

export const OssCombatNarrationSchema = OssNarrationResponseSchema.superRefine((data, ctx) => {
    const text =
        data.narration?.trim() ??
        (data.logEntries?.[0]
            ? typeof data.logEntries[0].content === 'string'
                ? data.logEntries[0].content
                : ''
            : '');
    if (text.length > MAX_COMBAT_NARRATION_CHARS) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Narração de combate muito longa (máx ${MAX_COMBAT_NARRATION_CHARS} caracteres).`,
        });
    }
    if (data.actionOptions.length < 2) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Combate exige pelo menos 2 actionOptions táticas.',
        });
    }
});

export type OssCombatNarration = z.infer<typeof OssCombatNarrationSchema>;

export function mapCombatToGameMasterShape(data: OssCombatNarration) {
    return mapOssNarrationToGameMasterShape(data);
}
