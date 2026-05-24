import { buildNarrativeContractPromptBlock, NARRATIVE_JSON_EXAMPLE } from './narrativeContract.js';

export type InstructionContext = {
    useAiHomebrew: boolean;
    enableNarrativeRevalidation?: boolean;
};

const buildNarrationOnlyInstruction = (ctx: InstructionContext): string => {
    const homebrewNote = ctx.useAiHomebrew
        ? 'Você pode mencionar itens ou criaturas homebrew já presentes no resumo da sessão, mas NÃO crie novos via JSON (sem newHomebrewContent).'
        : 'Use apenas elementos do cenário e SRD já descritos no contexto.';

    const revalidation = ctx.enableNarrativeRevalidation
        ? '\n- Antes de enviar, revise continuidade com o gameLog e stateHints; corrija contradições na própria prosa.'
        : '';

    return `Você é o MESTRE DE JOGO de Crônicas de Aventuras (D&D 5e).

${buildNarrativeContractPromptBlock()}

### Leitura do contexto (somente consulta — não altere via JSON)
- character, combatState, inventário e magias no prompt são REFERÊNCIA para narrar com precisão.
- stateHints e blocos [Motor] descrevem efeitos já aplicados pelo servidor.
- ${homebrewNote}

### Tom e opções
- Português do Brasil, imersivo, segunda pessoa quando falar ao jogador.
- logEntries: pelo menos 2 (narration + system se útil).
- actionOptions: 3 a 5 verbos concretos no mundo do jogo.
- Nunca instrua o jogador a burlar regras, editar ficha manualmente ou "pedir ao mestre" algo mecânico.
${revalidation}

Exemplo mínimo válido:
${JSON.stringify(NARRATIVE_JSON_EXAMPLE)}`;
};

export const createSystemInstruction = (ctx: InstructionContext): string =>
    buildNarrationOnlyInstruction(ctx);

const instructionCache = new Map<string, string>();

export const getCachedInstruction = (
    useAiHomebrew: boolean,
    enableNarrativeRevalidation = false,
): string => {
    const cacheKey = `${useAiHomebrew ? '1' : '0'}-${enableNarrativeRevalidation ? '1' : '0'}`;
    if (!instructionCache.has(cacheKey)) {
        instructionCache.set(
            cacheKey,
            createSystemInstruction({ useAiHomebrew, enableNarrativeRevalidation }),
        );
    }
    return instructionCache.get(cacheKey)!;
};
