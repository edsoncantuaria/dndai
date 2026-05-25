export type AiEngineMode = 'legacy' | 'oss';

export function resolveAiEngine(): AiEngineMode {
    const raw = (process.env.AI_ENGINE ?? 'legacy').trim().toLowerCase();
    return raw === 'oss' ? 'oss' : 'legacy';
}

export function isOssEngineEnabled(): boolean {
    return resolveAiEngine() === 'oss';
}
