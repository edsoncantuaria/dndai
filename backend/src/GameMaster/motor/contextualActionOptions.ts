type ActionOption = { text: string; action: string; skill?: string };

export function buildContextualActionOptions(input: {
    domain?: 'exploration' | 'social' | 'combat' | 'rest';
    combatActive?: boolean;
    levelUpPending?: boolean;
    shopOpen?: boolean;
    lootPending?: boolean;
    proficientSkills?: string[];
    knownSpells?: string[];
    playerRollPending?: boolean;
}): ActionOption[] {
    const options: ActionOption[] = [];

    if (input.levelUpPending) {
        options.push({ text: 'Confirmar avanço de nível', action: 'level-up' });
    }

    if (input.lootPending) {
        options.push({ text: 'Recolher tesouro', action: 'claim-loot' });
    }

    if (input.shopOpen) {
        options.push({ text: 'Negociar na loja', action: 'shop' });
        options.push({ text: 'Sair da loja', action: 'close-shop' });
    }

    if (input.playerRollPending) {
        options.push({ text: 'Cancelar ação', action: 'cancel' });
        return options.length >= 2 ? options : [...options, { text: 'Observar', action: 'wait' }];
    }

    const domain = input.combatActive ? 'combat' : input.domain ?? 'exploration';

    if (domain === 'combat') {
        options.push({ text: 'Atacar', action: 'attack' });
        options.push({ text: 'Esquivar', action: 'dodge' });
        options.push({ text: 'Recuar', action: 'disengage' });
        if (input.knownSpells?.length) {
            options.push({
                text: `Conjurar ${input.knownSpells[0]}`,
                action: 'spell-attack',
            });
        }
    } else if (domain === 'rest') {
        options.push({ text: 'Descanso curto', action: 'short-rest' });
        options.push({ text: 'Descanso longo', action: 'long-rest' });
        options.push({ text: 'Vigiar', action: 'watch', skill: 'perception' });
    } else {
        options.push({ text: 'Explorar a área', action: 'explorar' });
        options.push({ text: 'Observar arredores', action: 'observar', skill: 'perception' });
        options.push({ text: 'Conversar', action: 'conversar', skill: 'persuasion' });
        if (input.proficientSkills?.includes('investigation')) {
            options.push({ text: 'Investigar pistas', action: 'investigar', skill: 'investigation' });
        }
        if (input.knownSpells?.length) {
            options.push({ text: 'Preparar magia', action: 'spell-prep' });
        }
    }

    while (options.length < 3) {
        options.push({ text: 'Seguir em frente', action: 'seguir' });
    }

    return options.slice(0, 5);
}
