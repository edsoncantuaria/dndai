/**
 * P4.4 — trace estruturado ponta a ponta (WS → fila → worker → persist).
 * Ativo com ACTION_FLOW_DEBUG (default on) ou PIPELINE_TRACE=true.
 */

const TRACE_ENABLED =
    process.env.PIPELINE_TRACE === 'true' || process.env.ACTION_FLOW_DEBUG !== 'false';

export type PipelineTracePayload = Record<string, unknown> & {
    traceId?: string | null;
    sessionId?: number;
    actionId?: string | null;
    actionSequence?: number | null;
    userId?: number;
    phase?: string;
};

export function logPipelineTrace(stage: string, details: PipelineTracePayload): void {
    if (!TRACE_ENABLED) return;
    const line = {
        ts: new Date().toISOString(),
        stage,
        traceId: details.traceId ?? details.actionId ?? null,
        ...details,
    };
    console.log('[PipelineTrace]', JSON.stringify(line));
}
