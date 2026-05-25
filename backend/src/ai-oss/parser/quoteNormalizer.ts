/** Corrige aspas/simples erros comuns do gpt-oss em JSON. */
export function normalizeOssJsonQuotes(raw: string): string {
    let text = raw.trim();
    if (!text) return text;

    // Chaves com aspas simples: 'logEntries': → "logEntries":
    text = text.replace(/'([A-Za-z_][A-Za-z0-9_]*)'\s*:/g, '"$1":');
    // Aspas escapadas quebradas: \" → "
    text = text.replace(/\\"/g, '"');
    // Aspas tipográficas
    text = text.replace(/[""]/g, '"').replace(/['']/g, "'");

    return text;
}
