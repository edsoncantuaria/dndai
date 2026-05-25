import {
    OssNarrationResponseSchema,
    type OssNarrationResponse,
} from '../schemas/narration.schema.js';

export function validateOssNarration(data: unknown): {
    valid: boolean;
    data?: OssNarrationResponse;
    issues: string[];
} {
    const check = OssNarrationResponseSchema.safeParse(data);
    if (!check.success) {
        return {
            valid: false,
            issues: check.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        };
    }
    return { valid: true, data: check.data, issues: [] };
}
