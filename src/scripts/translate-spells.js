
import fs from 'fs';
import { TRANSLATIONS_SPELLS, translateSpell } from '../utils/TranslatorSpells.js';
import spells from '../data/spells.json' assert { type: 'json' };

const translatedSpells = spells.map(spell => {
  return translateSpell(spell);
});

fs.writeFileSync('data/spells_pt.json', JSON.stringify(translatedSpells, null, 2));
