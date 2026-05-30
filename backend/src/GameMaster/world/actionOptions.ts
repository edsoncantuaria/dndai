export type ActionDomain = 'exploration' | 'combat' | 'social';

const OPTIONS_PTBR: Record<ActionDomain, Array<{ id: string; label: string }>> = {
    exploration: [
        { id: 'explore', label: 'Explorar a área' },
        { id: 'investigate', label: 'Investigar' },
        { id: 'rest', label: 'Descansar' },
    ],
    combat: [
        { id: 'attack', label: 'Atacar' },
        { id: 'dodge', label: 'Esquivar' },
        { id: 'flee', label: 'Recuar' },
    ],
    social: [
        { id: 'talk', label: 'Conversar' },
        { id: 'persuade', label: 'Persuadir' },
        { id: 'intimidate', label: 'Intimidar' },
    ],
};

export function getActionOptionsForDomain(domain: ActionDomain) {
    return OPTIONS_PTBR[domain] ?? OPTIONS_PTBR.exploration;
}
