import { env } from '../../config/env.js';

export type PipelineCtx = {
    sessionId?: number;
    userId?: number;
    actionId?: string;
    actionSequence?: number;
};

const MAX_PREVIEW = 1200;
const MAX_PROMPT = 2400;

export function isPenaiPipelineLogEnabled(): boolean {
    if (process.env.PENAI_PIPELINE_LOG === '0') return false;
    if (process.env.PENAI_PIPELINE_LOG === '1') return true;
    if (env.AI_DEBUG_LOGS) return true;
    return process.env.NODE_ENV !== 'production';
}

function truncate(value: string, max = MAX_PREVIEW): string {
    const t = value.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}… (+${t.length - max} chars)`;
}

function formatCtx(ctx?: PipelineCtx): string {
    const parts: string[] = [];
    if (ctx?.sessionId != null) parts.push(`session=${ctx.sessionId}`);
    if (ctx?.actionSequence != null) parts.push(`seq=${ctx.actionSequence}`);
    if (ctx?.actionId) parts.push(`action=${ctx.actionId.slice(0, 8)}`);
    if (ctx?.userId != null) parts.push(`user=${ctx.userId}`);
    return parts.length ? parts.join(' ') : '—';
}

function safeJson(value: unknown, max = MAX_PREVIEW): string {
    try {
        return truncate(JSON.stringify(value, null, 0) ?? String(value), max);
    } catch {
        return truncate(String(value), max);
    }
}

/** Log de etapa do pipeline (sempre que PENAI_PIPELINE_LOG / dev). */
export function penaiPipelineLog(
    phase: string,
    message: string,
    extra?: Record<string, unknown>,
    ctx?: PipelineCtx,
): void {
    if (!isPenaiPipelineLogEnabled()) return;
    const head = `[PENAI][pipeline] ${formatCtx(ctx)} | ${phase} | ${message}`;
    if (extra && Object.keys(extra).length > 0) {
        console.log(head, extra);
    } else {
        console.log(head);
    }
}

export function penaiPipelineWait(
    phase: string,
    message: string,
    ctx?: PipelineCtx,
): void {
    penaiPipelineLog(phase, `⏳ ${message}`, undefined, ctx);
}

export function penaiPipelineWsIn(
    type: string,
    ctx: PipelineCtx,
    payload?: Record<string, unknown>,
): void {
    if (!isPenaiPipelineLogEnabled()) return;
    const preview =
        typeof payload?.playerAction === 'string'
            ? truncate(payload.playerAction, 200)
            : typeof payload?.action === 'string'
              ? truncate(payload.action, 200)
              : undefined;
    penaiPipelineLog('WS_IN', type, preview ? { preview, ...pickIds(payload) } : pickIds(payload), ctx);
}

export function penaiPipelineWsOut(type: string, ctx: PipelineCtx, extra?: Record<string, unknown>): void {
    penaiPipelineLog('WS_OUT', type, extra, ctx);
}

function pickIds(payload?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!payload) return undefined;
    const out: Record<string, unknown> = {};
    for (const k of ['actionId', 'workflowId', 'sync', 'reason', 'code', 'awaitingRoll']) {
        if (payload[k] !== undefined) out[k] = payload[k];
    }
    return Object.keys(out).length ? out : undefined;
}

export function penaiPipelineAiRequest(
    kind: string,
    ctx: PipelineCtx,
    opts: { model?: string; prompt?: unknown; inputSummary?: string },
): void {
    if (!isPenaiPipelineLogEnabled()) return;
    const body =
        opts.inputSummary ??
        (opts.prompt !== undefined ? safeJson(opts.prompt, MAX_PROMPT) : undefined);
    penaiPipelineLog(
        `AI_REQ:${kind}`,
        opts.model ? `model=${opts.model}` : 'chamada Gemini',
        body ? { prompt: body } : undefined,
        ctx,
    );
}

export function penaiPipelineAiResponse(
    kind: string,
    ctx: PipelineCtx,
    opts: { ms: number; raw?: string; parsed?: unknown; ok?: boolean; error?: string },
): void {
    if (!isPenaiPipelineLogEnabled()) return;
    const extra: Record<string, unknown> = { ms: Math.round(opts.ms) };
    if (opts.ok !== undefined) extra.ok = opts.ok;
    if (opts.error) extra.error = truncate(opts.error, 400);
    if (opts.parsed !== undefined) extra.parsed = safeJson(opts.parsed, MAX_PREVIEW);
    else if (opts.raw) extra.raw = truncate(opts.raw, MAX_PREVIEW);
    penaiPipelineLog(`AI_RES:${kind}`, opts.ok === false ? 'falhou' : 'ok', extra, ctx);
}

/** Bloco de preview legível (pulso do mundo, ticks, etc.). */
export function penaiPipelinePreview(
    phase: string,
    title: string,
    items: Array<{ label: string; preview: string }>,
    ctx?: PipelineCtx,
): void {
    if (!isPenaiPipelineLogEnabled()) return;
    penaiPipelineLog(phase, title, { count: items.length }, ctx);
    for (const item of items) {
        console.log(`  [PENAI][preview] ${item.label}: ${truncate(item.preview, 320)}`);
    }
}
