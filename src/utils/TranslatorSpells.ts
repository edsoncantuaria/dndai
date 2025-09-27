import type { ApiSpell } from '@/types';

export const TRANSLATIONS_SPELLS: Record<string, any> = {
    // This can be populated with full spell translations if needed,
    // but for now, we'll use a dynamic approach.
};

// A more robust translation function that handles nested properties
export const translateSpell = (spell: ApiSpell): ApiSpell => {
    if (!spell) return spell;

    const translatedSpell = { ...spell };

    const spellTranslation = TRANSLATIONS_SPELLS[spell.name];

    translatedSpell.name = spellTranslation?.name || spell.name;
    translatedSpell.desc = spellTranslation?.desc || spell.desc;
    translatedSpell.higher_level = spellTranslation?.higher_level || spell.higher_level;
    translatedSpell.material = spellTranslation?.material || spell.material;

    if (translatedSpell.school?.name) {
        translatedSpell.school.name = translatedSpell.school.name;
    }

    if (translatedSpell.damage?.damage_type?.name) {
        translatedSpell.damage.damage_type.name = translatedSpell.damage.damage_type.name;
    }

    return translatedSpell;
};
