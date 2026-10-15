/** Texto curto para o jogador (UI / log), separado do prompt completo enviado ao LLM. */
export function resolvePlayerActionForDisplay(
    llmPrompt: string,
    displayPlayerAction?: string | null,
): string | null {
    const explicit = displayPlayerAction?.trim();
    if (explicit) return explicit;

    const match = llmPrompt.match(/Ação do jogador:\s*([^\n]+)/i);
    if (match?.[1]?.trim()) return match[1].trim();

    if (
        llmPrompt.includes('[Elenco da sessão') ||
        llmPrompt.includes('[Fase:') ||
        llmPrompt.startsWith('Recarregar estado atual')
    ) {
        return null;
    }

    const trimmed = llmPrompt.trim();
    if (
        /^teste localhost/i.test(trimmed) ||
        /^post-deploy:/i.test(trimmed) ||
        /^(validate|reval|local|post-deploy)-/i.test(trimmed)
    ) {
        return null;
    }

    if (!trimmed || trimmed.length > 280) return null;
    return trimmed;
}
