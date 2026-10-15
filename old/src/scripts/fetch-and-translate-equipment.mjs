
import fs from 'fs';
import * as deepl from 'deepl-node';
import dotenv from 'dotenv';
dotenv.config();

const authKey = process.env.API_DEEPL;
const translator = new deepl.Translator(authKey);
const DND_API_URL = 'https://www.dnd5eapi.co';

async function fetchAllEquipment() {
  const response = await fetch(`${DND_API_URL}/api/equipment`);
  const data = await response.json();
  return data.results;
}

async function fetchEquipmentDetails(url) {
  const response = await fetch(`${DND_API_URL}${url}`);
  return await response.json();
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateTranslations() {
  const allEquipmentList = await fetchAllEquipment();
  const translations = {};
  let itemCount = 0;

  for (const equipment of allEquipmentList) {
    itemCount++;
    console.log(`Processing equipment ${itemCount} of ${allEquipmentList.length}: ${equipment.name}`);
    const details = await fetchEquipmentDetails(equipment.url);

    const textsToTranslate = [];
    const itemStructure = {};

    // Gather texts
    if (details.name) {
      textsToTranslate.push(details.name);
      itemStructure.name = textsToTranslate.length - 1;
    }
    if (details.desc && details.desc.length > 0) {
        const descIndexes = [];
        details.desc.forEach(d => {
            textsToTranslate.push(d);
            descIndexes.push(textsToTranslate.length - 1);
        });
        itemStructure.desc = descIndexes;
    }
    if (details.weapon_category) {
        textsToTranslate.push(details.weapon_category);
        itemStructure.weapon_category = textsToTranslate.length - 1;
    }
    if (details.weapon_range) {
        textsToTranslate.push(details.weapon_range);
        itemStructure.weapon_range = textsToTranslate.length - 1;
    }
    if (details.category_range) {
        textsToTranslate.push(details.category_range);
        itemStructure.category_range = textsToTranslate.length - 1;
    }
    if (details.damage && details.damage.damage_type && details.damage.damage_type.name) {
        textsToTranslate.push(details.damage.damage_type.name);
        itemStructure.damage_type_name = textsToTranslate.length - 1;
    }
     if (details.two_handed_damage && details.two_handed_damage.damage_type && details.two_handed_damage.damage_type.name) {
        textsToTranslate.push(details.two_handed_damage.damage_type.name);
        itemStructure.two_handed_damage_type_name = textsToTranslate.length - 1;
    }
    if(details.properties && details.properties.length > 0){
        const propertiesIndexes = [];
        details.properties.forEach(p => {
            textsToTranslate.push(p.name);
            propertiesIndexes.push(textsToTranslate.length - 1);
        });
        itemStructure.properties = propertiesIndexes;
    }

    try {
      if (textsToTranslate.length > 0) {
        const translatedTexts = await translator.translateText(textsToTranslate, null, 'pt-BR');
        const newItem = {};

        if (itemStructure.name !== undefined) {
          newItem.name = translatedTexts[itemStructure.name].text;
        }
        if (itemStructure.desc) {
            newItem.desc = itemStructure.desc.map(i => translatedTexts[i].text);
        }
        if (itemStructure.weapon_category !== undefined) {
            newItem.weapon_category = translatedTexts[itemStructure.weapon_category].text;
        }
        if (itemStructure.weapon_range !== undefined) {
            newItem.weapon_range = translatedTexts[itemStructure.weapon_range].text;
        }
        if (itemStructure.category_range !== undefined) {
            newItem.category_range = translatedTexts[itemStructure.category_range].text;
        }
        if (itemStructure.damage_type_name !== undefined) {
            newItem.damage_type_name = translatedTexts[itemStructure.damage_type_name].text;
        }
        if (itemStructure.two_handed_damage_type_name !== undefined) {
            newItem.two_handed_damage_type_name = translatedTexts[itemStructure.two_handed_damage_type_name].text;
        }
        if(itemStructure.properties){
            newItem.properties = itemStructure.properties.map(i => translatedTexts[i].text);
        }

        translations[details.index] = newItem;
      } else {
         translations[details.index] = {};
      }
    } catch (error) {
      console.error(`Could not translate texts for ${details.name}:`, error);
      translations[details.index] = {};
    }

    await delay(200);
  }

  const tsContent = `
export const TRANSLATIONS_EQUIPMENT: Record<string, any> = ${JSON.stringify(translations, null, 2)};

export const translateEquipment = (equipment: any): any => {
    const translatedEquipment = TRANSLATIONS_EQUIPMENT[equipment.index];
    if (translatedEquipment) {
        const newEquipment = JSON.parse(JSON.stringify(equipment));

        if(translatedEquipment.name) newEquipment.name = translatedEquipment.name;
        if(translatedEquipment.desc) newEquipment.desc = translatedEquipment.desc;
        if(translatedEquipment.weapon_category) newEquipment.weapon_category = translatedEquipment.weapon_category;
        if(translatedEquipment.weapon_range) newEquipment.weapon_range = translatedEquipment.weapon_range;
        if(translatedEquipment.category_range) newEquipment.category_range = translatedEquipment.category_range;

        if(translatedEquipment.damage_type_name && newEquipment.damage && newEquipment.damage.damage_type) {
            newEquipment.damage.damage_type.name = translatedEquipment.damage_type_name;
        }
        if(translatedEquipment.two_handed_damage_type_name && newEquipment.two_handed_damage && newEquipment.two_handed_damage.damage_type) {
            newEquipment.two_handed_damage.damage_type.name = translatedEquipment.two_handed_damage_type_name;
        }
        if(translatedEquipment.properties && newEquipment.properties && newEquipment.properties.length === translatedEquipment.properties.length){
             newEquipment.properties.forEach((p, i) => {
                p.name = translatedEquipment.properties[i];
             });
        }
        return newEquipment;
    }
    return equipment;
};
`;

  fs.writeFileSync('utils/TranslatorEquipments.ts', tsContent);
  console.log('File "utils/TranslatorEquipments.ts" created successfully. ✅');
}

generateTranslations();
