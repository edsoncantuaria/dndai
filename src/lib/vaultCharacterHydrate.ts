import type { Attributes } from '@/types';
import type { CharacterCreatorState } from '@/hooks/character-creation/reducer';

type VaultCharacterRecord = Record<string, unknown>;

function pickString(raw: VaultCharacterRecord, ...keys: string[]): string {
    for (const key of keys) {
        const v = raw[key];
        if (typeof v === 'string' && v.trim()) return v;
    }
    return '';
}

function pickAttributes(raw: VaultCharacterRecord): Attributes {
    const attrs = (raw.attributes ?? {}) as Record<string, unknown>;
    const num = (k: keyof Attributes) => Number(attrs[k] ?? 10);
    return {
        strength: num('strength'),
        dexterity: num('dexterity'),
        constitution: num('constitution'),
        intelligence: num('intelligence'),
        wisdom: num('wisdom'),
        charisma: num('charisma'),
    };
}

/** Converte herói do cofre (GET /v2/characters/:id) em estado inicial do wizard. */
export function vaultCharacterToCreatorState(raw: VaultCharacterRecord): Partial<CharacterCreatorState> {
    const spellsRaw = raw.spells;
    const spellIndexes = Array.isArray(spellsRaw)
        ? spellsRaw
              .map(entry =>
                  typeof entry === 'string'
                      ? entry
                      : entry && typeof entry === 'object' && 'index' in entry
                        ? String((entry as { index: string }).index)
                        : '',
              )
              .filter(Boolean)
        : [];

    return {
        name: pickString(raw, 'name'),
        sex: (pickString(raw, 'sex') as CharacterCreatorState['sex']) || 'Masculino',
        hairStyle: (pickString(raw, 'hairStyle') as CharacterCreatorState['hairStyle']) || 'Curto',
        beardStyle: (pickString(raw, 'beardStyle') as CharacterCreatorState['beardStyle']) || 'Sem Barba',
        skinColor: (pickString(raw, 'skinColor') as CharacterCreatorState['skinColor']) || 'Parda',
        race: pickString(raw, 'raceIndex', 'race'),
        subrace: pickString(raw, 'subraceIndex', 'subrace'),
        characterClass: pickString(raw, 'classIndex', 'characterClass'),
        background: pickString(raw, 'backgroundIndex', 'background'),
        alignment: pickString(raw, 'alignment'),
        backstory: pickString(raw, 'backstory'),
        attributeMethod: 'point-buy',
        points: 0,
        baseAttributes: pickAttributes(raw),
        personalityTraits: Array.isArray(raw.personalityTraits)
            ? (raw.personalityTraits as string[])
            : [],
        ideal: pickString(raw, 'ideal'),
        bond: pickString(raw, 'bond'),
        flaw: pickString(raw, 'flaw'),
        draconicAncestry: pickString(raw, 'draconicAncestry'),
        chosenClassSpells: spellIndexes,
        chosenLanguages: Array.isArray(raw.languages) ? (raw.languages as string[]) : [],
    };
}
