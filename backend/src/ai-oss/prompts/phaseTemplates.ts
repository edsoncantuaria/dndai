import type { GameMasterFlowInput } from '../../schemas/gameSchemas.js';

export type PromptPhase = 'exploration' | 'combat' | 'social';

const SOCIAL_PATTERN =
    /\b(falar|conversar|persuadir|intimidar|negociar|perguntar|convencer|diplomacia|mentir|subornar|discutir)\b/i;

export function detectPromptPhase(input: {
    playerAction: string;
    combatActive?: boolean;
    flowInput?: GameMasterFlowInput;
}): PromptPhase {
    const combat = Boolean(
        input.combatActive ?? input.flowInput?.combatState?.isActive,
    );
    if (combat) return 'combat';

    const action = input.playerAction?.trim() ?? '';
    if (SOCIAL_PATTERN.test(action)) return 'social';

    return 'exploration';
}

const PHASE_HINTS: Record<PromptPhase, string> = {
    exploration:
        'Fase=exploração: cena vívida (lugar, clima, pessoas), 1 complicação ou oportunidade; 4 actionOptions específicas ao local (não genéricas).',
    combat:
        'Fase=combate: ritmo rápido, consequências visíveis; sem resolver dados.',
    social:
        'Fase=social: diálogo, tom de NPCs, subtexto; ações de conversa e leitura de pessoas.',
};

export function buildPhaseTemplateHint(phase: PromptPhase): string {
    return PHASE_HINTS[phase];
}

export function appendPhaseTemplateToSystem(systemInstruction: string, phase: PromptPhase): string {
    const hint = buildPhaseTemplateHint(phase);
    if (systemInstruction.includes(hint)) return systemInstruction;
    return `${systemInstruction}\n${hint}`;
}
