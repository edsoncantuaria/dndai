/** Stubs para action-pipeline legado até remoção total do Express WS. */
export function isOssStreamEnabled(): boolean {
    return !['0', 'false', 'no', 'off'].includes(
        (process.env.GEMINI_STREAM_NARRATION ?? 'true').trim().toLowerCase(),
    );
}

export function registerNarrationStreamSink(
    _actionId: string,
    _sink: (chunk: string) => void,
): () => void {
    return () => clearNarrationStreamSink(_actionId);
}

export function clearNarrationStreamSink(_actionId: string): void {}

export function wrapNarrationStreamPayload(
    _actionId: string,
    _kind: string | undefined,
    evt: Record<string, unknown>,
): Record<string, unknown> {
    return evt;
}
