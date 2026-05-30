/**
 * @deprecated Use `GameMaster/motor` (PENAI_MOTOR) diretamente.
 */
export { classifyPenaiIntent } from '../motor/classifyIntent.js';
export type { PenaiActionIntent } from '../motor/types.js';
export type { PenaiMotorInput as ActionIngressInput, PenaiMotorResult as ActionIngressResult } from '../motor/types.js';

import type { PenaiMotorInput, PenaiMotorResult } from '../motor/types.js';
import { validateAndApply } from '../motor/validateAndApply.js';

export async function processActionIngress(input: PenaiMotorInput): Promise<PenaiMotorResult> {
    const result = await validateAndApply(input);
    return {
        ...result,
        blocked: result.blocked,
    };
}
