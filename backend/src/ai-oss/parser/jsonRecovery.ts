export type { ParseJsonResult, JsonRepairStrategy } from '../../ai/responseParser.js';
export { runOssRepairPass, type OssRepairPassResult, type OssRepairStage } from './repairPass.js';
export { tryLocalOssFieldRepair } from './localFieldRepair.js';
export { normalizeOssJsonQuotes } from './quoteNormalizer.js';

import { runOssRepairPass } from './repairPass.js';

/** Extrai e repara JSON da resposta OSS (normalização + pipeline legado). */
export function parseOssJsonResponse(rawText: string) {
    return runOssRepairPass(rawText);
}
