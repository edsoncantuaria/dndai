// This file is restored but is now largely superseded by the dndApiService and the translator files.
// It is kept for reference or if you decide to switch back to a more manual translation/data management approach.

import { TRANSLATIONS_SPELLS } from '@/utils/TranslatorSpells';
import type { ApiSpell } from '@/types';

export const translateSpell = (spell: ApiSpell): ApiSpell => {
    const translation = TRANSLATIONS_SPELLS[spell.name as keyof typeof TRANSLATIONS_SPELLS];
    if (translation) {
        return {
            ...spell,
            name: translation.name || spell.name,
            desc: translation.desc || spell.desc,
            higher_level: translation.higher_level || spell.higher_level,
            material: translation.material || spell.material,
        };
    }
    return spell;
};
