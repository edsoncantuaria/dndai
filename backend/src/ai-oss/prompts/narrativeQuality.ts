/** Bloco de qualidade narrativa — reduz respostas telegráficas do OSS free. */

export const OSS_NARRATIVE_QUALITY_BLOCK = `Qualidade narrativa (siga as regras abaixo; NÃO crie chave "QUALIDADE_NARRATIVA" nem outras extras no JSON):
- Escreva prosa imersiva em português (Brasil), 3–6 frases por turno (exploração/social) ou 2–4 em combate.
- Use sentidos (luz, som, cheiro, temperatura), emoção do PJ e um gancho para o próximo passo.
- Evite listas secas, resumos de sistema ("sem eventos recentes") e frases de uma linha só.
- actionOptions: 4 strings OU objetos {text, action}; textos curtos (8–18 palavras), sem IDs técnicos no campo text.
- narration: sempre string (nunca array). newFacts[].importance: apenas "low", "medium" ou "high" (inglês).
- Prefira logEntries com UMA entrada type=narration contendo todo o texto; não divida em micro-parágrafos vazios.`;

export function buildOpeningSceneHint(playerAction: string): string | undefined {
    const a = playerAction.trim().toLowerCase();
    if (!a.includes('aventura começa') && !a.includes('onde eu estou')) return undefined;
    return (
        'ABERTURA_DE_SESSÃO: apresente a região com atmosfera cinematográfica, 2 NPCs ou pistas visíveis, ' +
        'tom de mistério ou tensão leve, e convide o jogador a agir. Não diga apenas que "não há eventos".'
    );
}
