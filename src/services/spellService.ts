
import { Spell } from '../types';
import { TRANSLATIONS } from '../utils/translator';

const API_BASE_URL = 'https://www.dnd5eapi.co/api';

const spellTranslations: { [key: string]: Partial<Spell> } = {
  'acid-arrow': {
    name: 'Flecha Ácida',
    desc: [
      'Uma flecha esverdeada e cintilante voa em direção a um alvo dentro do alcance e explode em um jato de ácido. Faça um ataque à distância com magia contra o alvo. Se atingir, o alvo sofre 4d4 de dano de ácido imediatamente e 2d4 de dano de ácido no final de seu próximo turno. Se errar, a flecha espirra ácido no alvo, causando metade do dano inicial e nenhum dano no final de seu próximo turno.',
    ],
    higher_level: [
      'Quando você lança esta magia usando um slot de magia de 3º nível ou superior, o dano (tanto inicial quanto subsequente) aumenta em 1d4 para cada nível de slot acima do 2º.',
    ],
  },
  // Adicione outras traduções de magias aqui
};

export const fetchSpells = async (): Promise<Spell[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/spells`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const spellList = await response.json();

    const spellDetailsPromises = spellList.results.map(async (spellRef: any) => {
      try {
        const spellResponse = await fetch(`${API_BASE_URL}${spellRef.url}`);
        if (!spellResponse.ok) {
          console.error(`Could not fetch details for ${spellRef.name}: ${spellResponse.status}`);
          return null; 
        }
        return await spellResponse.json();
      } catch (e) {
        console.error(`Error fetching spell details for ${spellRef.name}:`, e);
        return null;
      }
    });

    const spellsData = (await Promise.all(spellDetailsPromises)).filter(spell => spell !== null);

    return spellsData.map(spell => {
      const translation = spellTranslations[spell.index] || {};
      const translatedSpell = { ...spell, ...translation };

      if (translatedSpell.school && TRANSLATIONS[translatedSpell.school.name.toLowerCase()]) {
        translatedSpell.school.name = TRANSLATIONS[translatedSpell.school.name.toLowerCase()];
      }

      return translatedSpell;
    });
  } catch (error) {
    console.error("Could not fetch spells:", error);
    return [];
  }
};
