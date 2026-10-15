/**
 * Log verboso de prompts/respostas no processo narration-worker.
 * Ativo com NARRATION_WORKER_VERBOSE=true, LOG_NARRATION_PROMPT=true ou RUN_NARRATION_WORKER=true.
 * Desligar: LOG_NARRATION_PROMPT=false
 */

const DISABLED = process.env.LOG_NARRATION_PROMPT === 'false';

export function isNarrationPromptLogEnabled(): boolean {
    if (DISABLED) return false;
    if (process.env.LOG_NARRATION_PROMPT === 'true') return true;
    if (process.env.NARRATION_WORKER_VERBOSE === 'true') return true;
    if (process.env.RUN_NARRATION_WORKER === 'true') return true;
    return false;
}

function maxChars(): number | null {
    const raw = process.env.NARRATION_PROMPT_LOG_MAX_CHARS;
    if (raw === undefined || raw === '' || raw === '0') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
}

function clip(text: string): string {
    const limit = maxChars();
    if (limit === null || text.length <= limit) return text;
    return `${text.slice(0, limit)}\n…[truncado ${text.length - limit} chars — aumente NARRATION_PROMPT_LOG_MAX_CHARS]`;
}

function logBlock(tag: string, meta: Record<string, unknown>, body: string): void {
    if (!isNarrationPromptLogEnabled()) return;
    const header = {
        ts: new Date().toISOString(),
        tag,
        ...meta,
        chars: body.length,
    };
    console.log('[narration-worker]', JSON.stringify(header));
    console.log(`[narration-worker:${tag}:begin]\n${clip(body)}\n[narration-worker:${tag}:end]`);
}

export function logNarrationWorkerJob(meta: {
    actionId: string;
    sessionId: number;
    userId: number;
    actionSequence?: number | null;
    kind?: string;
    displayPlayerAction?: string;
    playerActionPrompt: string;
    model?: string;
    apiKeyPresent?: boolean;
}): void {
    if (!isNarrationPromptLogEnabled()) return;
    console.log(
        '[narration-worker]',
        JSON.stringify({
            ts: new Date().toISOString(),
            tag: 'job:received',
            actionId: meta.actionId,
            sessionId: meta.sessionId,
            userId: meta.userId,
            actionSequence: meta.actionSequence ?? null,
            kind: meta.kind ?? 'action',
            displayPlayerAction: meta.displayPlayerAction ?? null,
            promptChars: meta.playerActionPrompt.length,
            model: meta.model ?? null,
            apiKeyPresent: meta.apiKeyPresent ?? null,
        }),
    );
    if (meta.displayPlayerAction) {
        logBlock('job:display_action', { actionId: meta.actionId }, meta.displayPlayerAction);
    }
    logBlock('job:player_action_prompt', { actionId: meta.actionId }, meta.playerActionPrompt);
}

export function logNarrationLlmRequest(meta: {
    actionId?: string;
    model: string;
    phase?: string;
    attempt?: number;
    systemInstruction: string;
    userPrompt: string;
}): void {
    logBlock('llm:system', { actionId: meta.actionId, model: meta.model, phase: meta.phase, attempt: meta.attempt }, meta.systemInstruction);
    logBlock('llm:user', { actionId: meta.actionId, model: meta.model, phase: meta.phase, attempt: meta.attempt }, meta.userPrompt);
}

export function logNarrationLlmResponse(meta: {
    actionId?: string;
    model: string;
    attempt?: number;
    latencyMs?: number;
    rawText: string;
}): void {
    if (!isNarrationPromptLogEnabled()) return;
    console.log(
        '[narration-worker]',
        JSON.stringify({
            ts: new Date().toISOString(),
            tag: 'llm:response_meta',
            actionId: meta.actionId ?? null,
            model: meta.model,
            attempt: meta.attempt ?? null,
            latencyMs: meta.latencyMs ?? null,
            rawChars: meta.rawText.length,
        }),
    );
    logBlock('llm:raw_json', { actionId: meta.actionId, model: meta.model }, meta.rawText);
}

export function logNarrationWorkerContext(meta: {
    actionId?: string;
    stage: string;
    payload: Record<string, unknown>;
}): void {
    if (!isNarrationPromptLogEnabled()) return;
    const lines = Object.entries(meta.payload)
        .map(([k, v]) => {
            if (typeof v === 'string') return `${k}=\n${v}`;
            return `${k}=${JSON.stringify(v)}`;
        })
        .join('\n\n');
    logBlock(`ctx:${meta.stage}`, { actionId: meta.actionId }, lines);
}
