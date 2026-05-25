/**
 * Compressão heurística de log (sem LLM) para caber no orçamento de contexto OSS.
 */
export function compressGameLogForOss(gameLog: string, maxChars = 1800): string {
    if (!gameLog?.trim()) return 'SEM_EVENTOS';
    if (gameLog.length <= maxChars) return gameLog;

    const lines = gameLog
        .split(/\n+/)
        .map(l => l.trim())
        .filter(Boolean);

    const unique: string[] = [];
    const seen = new Set<string>();
    for (let i = lines.length - 1; i >= 0 && unique.length < 24; i -= 1) {
        const key = lines[i].slice(0, 80).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.unshift(lines[i]);
    }

    let body = unique.join('\n');
    if (body.length > maxChars) {
        body = `[...${lines.length - unique.length} linhas omitidas]\n${body.slice(-maxChars)}`;
    }
    return body;
}
