import type { GameMasterFlowInput } from '../schemas/gameSchemas.js';
import { PROMPT_BUDGET } from './constants.js';

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

const truncateToBudget = (text: string, budget: number): string => {
    const maxChars = budget * 4;
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars - 1)}…`;
};

/** Monta blocos enxutos para o prompt (Fase 3.3). */
export function buildCompactPromptSections(input: GameMasterFlowInput): string {
    const sections: string[] = [];

    const char = input.character ?? {};
    const attrs = char.attributes ?? {};
    const stateBlock = [
        `HP=${attrs.hp ?? '?'}/${attrs.maxHp ?? attrs.hp ?? '?'}`,
        `AC=${attrs.ac ?? '?'}`,
        char.conditions?.length ? `Condições=${JSON.stringify(char.conditions)}` : null,
        char.currentRegion ? `Região=${char.currentRegion}` : null,
        input.combatState?.isActive ? `Combate=ativo R${input.combatState.round ?? 1}` : 'Combate=inativo',
    ].filter(Boolean).join(' | ');
    sections.push(`### ESTADO\n${truncateToBudget(stateBlock, PROMPT_BUDGET.state)}`);

    const actionBlock = [
        `Ação="${truncateToBudget(input.playerAction ?? '', PROMPT_BUDGET.action)}"`,
        input.stateHints?.length ? `Deltas=${input.stateHints.join('; ')}` : null,
    ].filter(Boolean).join('\n');
    sections.push(`### AÇÃO\n${actionBlock}`);

    const memoryParts = [
        input.storySummary ? `Resumo=${truncateToBudget(input.storySummary, 120)}` : null,
        input.timelineFacts ? `Fatos=${truncateToBudget(input.timelineFacts, PROMPT_BUDGET.memory - 120)}` : null,
        input.layeredMemorySummary ? truncateToBudget(input.layeredMemorySummary, PROMPT_BUDGET.memory) : null,
    ].filter(Boolean);
    if (memoryParts.length) {
        sections.push(`### MEMÓRIA\n${memoryParts.join('\n')}`);
    }

    if (input.regionGraphSummary || input.regionSlug) {
        const mapBlock = [
            input.regionSlug ? `Região=${input.regionSlug}` : null,
            input.regionGraphSummary ? truncateToBudget(input.regionGraphSummary, PROMPT_BUDGET.map) : null,
        ].filter(Boolean).join('\n');
        sections.push(`### MAPA\n${mapBlock}`);
    }

    const rulesHint = input.combatState?.isActive
        ? 'Modo=combate (foco em iniciativa, HP, condições)'
        : 'Modo=exploração (foco em descoberta e consequências)';
    sections.push(`### REGRAS\n${truncateToBudget(rulesHint, PROMPT_BUDGET.rules)}`);

    const joined = sections.join('\n\n');
    if (estimateTokens(joined) > PROMPT_BUDGET.totalSoftCap) {
        return truncateToBudget(joined, PROMPT_BUDGET.totalSoftCap);
    }
    return joined;
}
