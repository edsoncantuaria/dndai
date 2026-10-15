type ActionOption = { text: string; action: string; skill?: string };

export function buildPenaiActionOptions(input: {
    playerAction: string;
    narration?: string;
    domain?: 'exploration' | 'social' | 'combat' | 'rest';
    proficientSkills?: string[];
}): ActionOption[] {
    const domain = input.domain ?? 'exploration';
    const defaults: Record<string, ActionOption[]> = {
        exploration: [
            { text: 'Explorar a área', action: 'explorar' },
            { text: 'Observar arredores', action: 'observar', skill: 'perception' },
            { text: 'Seguir em frente', action: 'seguir' },
        ],
        social: [
            { text: 'Conversar', action: 'conversar', skill: 'persuasion' },
            { text: 'Investigar pistas', action: 'investigar', skill: 'investigation' },
            { text: 'Recuar discretamente', action: 'recuar', skill: 'stealth' },
        ],
        combat: [
            { text: 'Atacar', action: 'attack' },
            { text: 'Esquivar', action: 'dodge' },
            { text: 'Recuar', action: 'disengage' },
        ],
        rest: [
            { text: 'Descanso curto', action: 'short-rest' },
            { text: 'Descanso longo', action: 'long-rest' },
            { text: 'Vigiar', action: 'watch', skill: 'perception' },
        ],
    };
    return defaults[domain] ?? defaults.exploration;
}
