/**
 * P4.6 — streaming de narração é preview efêmero, nunca canônico.
 */

export const NARRATION_STREAM_CANONICAL = false;

export type NarrationStreamKind = 'preview' | 'structured' | 'done';

export function wrapNarrationStreamPayload(
    actionId: string,
    kind: NarrationStreamKind,
    extra: Record<string, unknown>,
): Record<string, unknown> {
    return {
        actionId,
        kind,
        canonical: NARRATION_STREAM_CANONICAL,
        ...extra,
    };
}

/** Só permite stream quando não há fila assíncrona ativa para o mesmo actionId. */
export function shouldEmitNarrationStream(opts: {
    streamEnabled: boolean;
    actionId?: string;
    asyncQueueActive?: boolean;
}): boolean {
    if (!opts.streamEnabled) return false;
    if (opts.asyncQueueActive) return false;
    return Boolean(opts.actionId);
}
