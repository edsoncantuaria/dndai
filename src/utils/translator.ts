// src/utils/translator.ts
import { getTranslations } from '@/services/translationService';

// Armazena as traduções em memória após o primeiro carregamento.
let translations: Record<string, Record<string, string>> = {};
let isLoaded = false;

/**
 * Carrega todas as traduções do backend e as armazena em memória.
 * Deve ser chamado na inicialização do aplicativo.
 */
export const loadTranslations = async () => {
    if (isLoaded) return;
    try {
        translations = await getTranslations();
        isLoaded = true;
        console.log('[Translator] Traduções carregadas com sucesso.');
    } catch (error) {
        console.error('[Translator] Falha ao carregar traduções do backend:', error);
        // O sistema continuará a funcionar, mas sem traduções.
    }
};

/**
 * Traduz uma string de uma categoria específica.
 * @param category A categoria da tradução (ex: 'Races', 'Classes').
 * @param key A chave/termo em inglês a ser traduzido.
 * @returns A string traduzida ou a chave original se não encontrada.
 */
const translate = (category: string, key: string): string => {
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

    // Itera sobre as principais categorias para encontrar uma correspondência.
    const categoriesToTry: (keyof typeof translations)[] = [
        'Races', 'Classes', 'Subclasses', 'Skills & Proficiencies', 'Equipment Categories'
    ];

    for (const category of categoriesToTry) {
        const translation = translations[category]?.[apiString];
        if (translation) return translation;
    }
    
    const key = apiString.toLowerCase().replace(/ /g, '-');
    const specific = translations['Skills & Proficiencies']?.[key];
    if (specific) return specific;


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

    // Remove prefixos conhecidos
    const prefixesToRemove = ['skill:', 'saving throw:', 'saving throw :'];
    for (const prefix of prefixesToRemove) {
        if (lowerCaseName.startsWith(prefix)) {
            const cleanName = name.substring(prefix.length).trim();
            return translateApiString(cleanName);
        }
    }

    return translateApiString(name);
};
