export type OssPromptLogPayload = {
    actionId?: string;
    sessionId?: string;
    model: string;
    phase: string;
    playerAction: string;
    systemInstruction: string;
    userPrompt: string;
    combatActive?: boolean;
};

function isPromptLogEnabled(): boolean {
    const v = (process.env.OSS_PROMPT_LOG ?? process.env.OSS_TRACE_LOG ?? 'false').trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(v);
}

/** Emite system + user no stdout do backend (visível em `docker logs`). */
export function logOssPromptBundle(payload: OssPromptLogPayload): void {
    if (!isPromptLogEnabled()) return;

    const id = payload.actionId?.trim() || `no-id-${Date.now()}`;
    const header = [
        `[oss-prompt] actionId=${id}`,
        payload.sessionId ? `sessionId=${payload.sessionId}` : null,
        `phase=${payload.phase}`,
        `model=${payload.model}`,
        payload.combatActive != null ? `combat=${payload.combatActive}` : null,
        `playerAction=${JSON.stringify(payload.playerAction)}`,
    ]
        .filter(Boolean)
        .join(' ');

    console.log(header);
    console.log('=== SYSTEM ===');
    console.log(payload.systemInstruction);
    console.log('=== USER ===');
    console.log(payload.userPrompt);
    console.log('[oss-prompt] --- fim ---');
}
