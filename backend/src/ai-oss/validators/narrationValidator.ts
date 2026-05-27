import { normalizeOssNarrationPayload } from '../parser/localFieldRepair.js';
import {
    OssNarrationResponseSchema,
    type OssNarrationResponse,
} from '../schemas/narration.schema.js';
import type { ActionDomain } from '../actions/registry.js';

export function validateOssNarration(
    data: unknown,
    opts: { domain?: ActionDomain; combatActive?: boolean } = {},
): {
    valid: boolean;
    data?: OssNarrationResponse;
    issues: string[];
} {
    const normalized = normalizeOssNarrationPayload(data, {
        domain: opts.domain,
        combatActive: opts.combatActive,
    });
    const candidate = normalized ?? data;
    const check = OssNarrationResponseSchema.safeParse(candidate);
    if (!check.success) {
        return {
            valid: false,
            issues: check.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        };
    }
    return { valid: true, data: check.data, issues: [] };
}
