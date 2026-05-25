export type NarrationStreamKind = 'preview' | 'structured' | 'done';

export type NarrationStreamEvent = {
    kind: NarrationStreamKind;
    /** Trecho de narração (preview) ou delta bruto. */
    text?: string;
    /** true quando o JSON completo foi recebido. */
    complete?: boolean;
};

export type NarrationStreamSink = (event: NarrationStreamEvent) => void;

const sinks = new Map<string, NarrationStreamSink>();

export function registerNarrationStreamSink(actionId: string, sink: NarrationStreamSink): () => void {
    sinks.set(actionId, sink);
    return () => {
        sinks.delete(actionId);
    };
}

export function emitNarrationStream(actionId: string | undefined, event: NarrationStreamEvent): void {
    if (!actionId) return;
    const sink = sinks.get(actionId);
    if (sink) sink(event);
}

export function clearNarrationStreamSink(actionId: string): void {
    sinks.delete(actionId);
}

export function clearAllNarrationStreamSinksForTests(): void {
    sinks.clear();
}
