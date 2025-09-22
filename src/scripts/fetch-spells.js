import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE_URL = 'https://www.dnd5eapi.co/api/2014';
const BASE_URL = 'https://www.dnd5eapi.co'
const TRANSLATIONS = {
    // Magic Schools
    'abjuration': 'Abjuração',
    'conjuration': 'Conjuração',
    'divination': 'Adivinhação',
    'enchantment': 'Encantamento',
    'evocation': 'Evocação',
    'illusion': 'Ilusão',
    'necromancy': 'Necromancia',
    'transmutation': 'Transmutação',
};

// Adiciona uma função para criar um atraso (delay)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchSpells = async () => {
  try {
    console.log('Buscando a lista de magias...');
    const response = await fetch(`${API_BASE_URL}/equipament`);
    if (!response.ok) {
      throw new Error(`Erro HTTP! status: ${response.status}`);
    }
    const spellList = await response.json();
    console.log(`Encontradas ${spellList.results.length} magias. Buscando detalhes...`);

    const spellsData = [];
    // Itera sobre a lista de magias sequencialmente, e não mais em paralelo
    for (const spellRef of spellList.results) {
      try {
        console.log(`Buscando ${spellRef.name}...`);
        const spellResponse = await fetch(`${BASE_URL}${spellRef.url}`);
        if (!spellResponse.ok) {
          console.error(`${BASE_URL}/${spellRef.url}`);
          console.error(` ${spellRef.url}: spellRef.url`);
          console.error(`Não foi possível buscar os detalhes de ${spellRef.name}: ${spellResponse.status}`);
          continue; // Pula para a próxima magia em caso de erro
        }
        const spellDetail = await spellResponse.json();
        spellsData.push(spellDetail);
      } catch (e) {
        console.error(`Erro ao buscar detalhes de ${spellRef.name}:`, e);
      }
      // Adiciona uma pausa de 50 milissegundos entre cada requisição para não sobrecarregar a API
      await sleep(50);
    }

    console.log('Traduzindo e salvando as magias...');
    const translatedSpells = spellsData.map(spell => {
      const translatedSpell = { ...spell };

      if (translatedSpell.school && TRANSLATIONS[translatedSpell.school.name.toLowerCase()]) {
        translatedSpell.school.name = TRANSLATIONS[translatedSpell.school.name.toLowerCase()];
      }

      // A lógica para unir as traduções do spells.js antigo iria aqui.
      // Como o arquivo já foi processado, este script agora apenas busca os dados mais recentes da API.

      return translatedSpell;
    });

    const outputPath = path.resolve(__dirname, '../data/spells.json');
    fs.writeFileSync(outputPath, JSON.stringify(translatedSpells, null, 2));
    console.log(`Magias buscadas e traduzidas com sucesso! Salvas em ${outputPath}`);

  } catch (error) {
    console.error("Não foi possível buscar as magias:", error);
  }
};

fetchSpells();
