import { offloadLargePayload } from '../services/objectStorageService.js';

const LOG_STORAGE_THRESHOLD = 1800;

/** Serializa payload de log; offload para storage se exceder limite. */
export const prepareLogPayload = async (
    sessaoId: number,
    type: string,
    payload: unknown,
): Promise<string> => {
    if (payload === undefined || payload === null) return '';
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (!serialized) return '';
    if (serialized.length < LOG_STORAGE_THRESHOLD) return serialized;
    const offloaded = await offloadLargePayload(serialized, { prefix: `sessions/${sessaoId}/${type}` });
    return offloaded ?? serialized;
};
