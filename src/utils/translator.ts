// src/utils/translator.ts
import { getTranslations } from '@/services/translationService';
import type { InventoryItem } from '@/types';

const ENABLE_TRANSLATIONS = process.env.NEXT_PUBLIC_ENABLE_TRANSLATIONS === 'true';

// Armazena as traduções em memória após o primeiro carregamento.
let translations: Record<string, Record<string, string>> = {};
let equipmentTranslations: Record<string, any> = {};
let isLoaded = false;

/**
 * Carrega todas as traduções do backend e as armazena em memória.
 * Deve ser chamado na inicialização do aplicativo.
 */
export const loadTranslations = async () => {
    if (!ENABLE_TRANSLATIONS) {
        isLoaded = true;
        return;
    }

    if (isLoaded) return;
    try {
        const data = await getTranslations();
        // Assume que uma das categorias será 'Equipment'
        const { Equipment, ...rest } = data;
        translations = rest;
        equipmentTranslations = Equipment || {};
        isLoaded = true;
        console.log('[Translator] Traduções carregadas com sucesso.');
    } catch (error) {
        console.error('[Translator] Falha ao carregar traduções do backend:', error);
    }
};

/**
 * Traduz uma string de uma categoria específica.
 * @param category A categoria da tradução (ex: 'Races', 'Classes').
 * @param key A chave/termo em inglês a ser traduzido.
 * @returns A string traduzida ou a chave original se não encontrada.
 */
const translate = (category: string, key: string): string => {
    if (!ENABLE_TRANSLATIONS) return key;
    if (!key) return '';
    return translations[category]?.[key] || key;
};

/**
 * Traduz um nome de condição.
 * @param conditionName O nome da condição em inglês.
 * @returns O nome traduzido.
 */
export const translateCondition = (conditionName: string): string => {
    return translate('Conditions', conditionName);
};

/**
 * Traduz um nome de atributo.
 * @param attributeKey A chave do atributo (ex: 'strength').
 * @returns O nome traduzido (ex: 'Força').
 */
export const translateAttribute = (attributeKey: string): string => {
    return translate('Attributes', attributeKey);
};

/**
 * Traduz uma string genérica da API, tentando várias categorias.
 * @param apiString A string em inglês da API.
 * @returns A string traduzida ou a original se não encontrada.
 */
export const translateApiString = (apiString: string): string => {
    if (!apiString) return '';

    const categoriesToTry: (keyof typeof translations)[] = [
        'Races', 'Classes', 'Subclasses', 'Skills & Proficiencies', 'Equipment Categories'
    ];

    for (const category of categoriesToTry) {
        const translation = translations[category]?.[apiString];
        if (translation) return translation;
    }
    
    return apiString;
};

/**
 * Normaliza e traduz um nome de proficiência da API.
 * Remove prefixos como "Skill:" e traduz o termo.
 * @param name O nome da proficiência vindo da API (ex: "Skill: Stealth").
 * @returns O nome da proficiência traduzido e limpo (ex: "Furtividade").
 */
export const normalizeProficiencyName = (name: string): string => {
    if (!name) return '';
    const lowerCaseName = name.toLowerCase();

    const prefixesToRemove = ['skill:', 'saving throw:', 'saving throw :'];
    for (const prefix of prefixesToRemove) {
        if (lowerCaseName.startsWith(prefix)) {
            const cleanName = name.substring(prefix.length).trim();
            return translateApiString(cleanName);
        }
    }

    return translateApiString(name);
};


/**
 * Traduz de forma profunda um objeto de equipamento, incluindo suas propriedades.
 * @param equipment O objeto de equipamento a ser traduzido.
 * @returns Um novo objeto de equipamento com os campos traduzidos.
 */
export const translateEquipment = (equipment: InventoryItem): InventoryItem => {
    if (!ENABLE_TRANSLATIONS) {
        return equipment;
    }

    if (!equipment?.index) return equipment;

    // Deep copy para não mutar o objeto original
    const newEquipment = JSON.parse(JSON.stringify(equipment));
    
    const translation = equipmentTranslations[equipment.index];

    if (translation) {
        if (translation.name) newEquipment.name = translation.name;
        if (translation.desc) newEquipment.desc = translation.desc;
        if (translation.weapon_category) newEquipment.weapon_category = translation.weapon_category;
        if (translation.weapon_range) newEquipment.weapon_range = translation.weapon_range;
        if (translation.category_range) newEquipment.category_range = translation.category_range;

        if (translation.damage_type_name && newEquipment.damage?.damage_type) {
            newEquipment.damage.damage_type.name = translation.damage_type_name;
        }
        if (translation.two_handed_damage_type_name && newEquipment.two_handed_damage?.damage_type) {
            newEquipment.two_handed_damage.damage_type.name = translation.two_handed_damage_type_name;
        }

        if (translation.properties && Array.isArray(newEquipment.properties)) {
            newEquipment.properties.forEach((p: any, i: number) => {
                if(i < translation.properties.length) {
                    if (typeof p === 'object' && p !== null) {
                        p.name = translation.properties[i];
                    } else {
                        // Se 'p' for uma string, transforme-o em um objeto antes de atribuir.
                        newEquipment.properties[i] = { name: translation.properties[i], index: p };
                    }
                }
            });
        }
    }
    
    return newEquipment;
};
