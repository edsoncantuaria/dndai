import type { NpcArchetype } from './npcSheet.js';

export type NpcClassProfile = {
    characterClass: string;
    characterClassLabel: string;
    isSpellcaster: boolean;
};

const ROLE_CLASS: Array<{ match: RegExp; profile: NpcClassProfile }> = [
    {
        match: /mago|arcan|feiticeir|brux|wizard/i,
        profile: { characterClass: 'wizard', characterClassLabel: 'Mago', isSpellcaster: true },
    },
    {
        match: /clérigo|sacerdote|acólito|templo|curandeir/i,
        profile: { characterClass: 'cleric', characterClassLabel: 'Clérigo', isSpellcaster: true },
    },
    {
        match: /bardo|taverneiro|menestrel/i,
        profile: { characterClass: 'bard', characterClassLabel: 'Bardo', isSpellcaster: true },
    },
    {
        match: /ladino|batedor|scout|caçador/i,
        profile: { characterClass: 'rogue', characterClassLabel: 'Ladino', isSpellcaster: false },
    },
    {
        match: /guard|milíc|soldad|capitão|guerreiro|veterano/i,
        profile: { characterClass: 'fighter', characterClassLabel: 'Guerreiro', isSpellcaster: false },
    },
    {
        match: /ferreir|artesão|mercador|comércio/i,
        profile: { characterClass: 'commoner', characterClassLabel: 'Plebeu', isSpellcaster: false },
    },
];

export function classProfileFromRole(role: string, archetype: NpcArchetype): NpcClassProfile {
    const hit = ROLE_CLASS.find(r => r.match.test(role));
    if (hit) return hit.profile;
    if (archetype === 'acolyte') {
        return { characterClass: 'cleric', characterClassLabel: 'Clérigo', isSpellcaster: true };
    }
    if (archetype === 'scout') {
        return { characterClass: 'rogue', characterClassLabel: 'Ladino', isSpellcaster: false };
    }
    return { characterClass: 'fighter', characterClassLabel: 'Guerreiro', isSpellcaster: false };
}

/** Truques e magias por classe (índices SRD usados no app). */
export function spellsForNpcClass(characterClass: string, level: number): string[] {
    const lvl = Math.max(1, Math.min(20, level));
    switch (characterClass) {
        case 'wizard':
            return [
                'fire-bolt',
                'mage-hand',
                ...(lvl >= 2 ? ['magic-missile'] : []),
                ...(lvl >= 3 ? ['shield'] : []),
            ];
        case 'cleric':
            return [
                'sacred-flame',
                'spare-the-dying',
                ...(lvl >= 2 ? ['cure-wounds'] : []),
                ...(lvl >= 3 ? ['bless'] : []),
            ];
        case 'bard':
            return [
                'vicious-mockery',
                'prestidigitation',
                ...(lvl >= 2 ? ['healing-word'] : []),
            ];
        default:
            return [];
    }
}

export function spellSlotsForNpcLevel(
    level: number,
    characterClass: string,
): Record<string, { current: number; max: number }> {
    if (!['wizard', 'cleric', 'bard', 'sorcerer', 'warlock', 'druid'].includes(characterClass)) {
        return {};
    }
    const slots: Record<string, { current: number; max: number }> = {};
    const l = Math.max(1, Math.min(20, level));
    if (l >= 1) slots['1'] = { current: 2, max: 2 };
    if (l >= 3) slots['2'] = { current: 2, max: 2 };
    if (l >= 5) slots['3'] = { current: 1, max: 1 };
    if (characterClass === 'warlock' && l >= 2) {
        return { pact: { current: 1, max: 1 } };
    }
    return slots;
}
