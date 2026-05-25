/**
 * Cliente HTTP OpenRouter — delega ao adapter (métricas via OpenRouterManager).
 */
import { OSS_120B_MODEL } from '../constants.js';
import { createInferenceAdapter } from './providerRegistry.js';

export function createOssModelAdapter(apiKey: string, model = OSS_120B_MODEL) {
    return createInferenceAdapter(apiKey, model);
}
