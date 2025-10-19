// src/utils/translator.ts

// Mapeamento manual para termos que não seguem o padrão "Skill: Name"
const specificTranslations: Record<string, string> = {
    'all-armor': 'Todas as Armaduras',
    'light-armor': 'Armaduras Leves',
    'medium-armor': 'Armaduras Médias',
    'heavy-armor': 'Armaduras Pesadas',
    'shields': 'Escudos',
    'simple-weapons': 'Armas Simples',
    'martial-weapons': 'Armas Marciais',
    'thieves-tools': 'Ferramentas de Ladrão',
};

const PROFICIENCY_TYPES: Record<string, string> = {
    'skill:': 'Perícia:',
    'saving-throw:': 'Resistência:',
    // Adicionar outros prefixos se necessário
};

/**
 * Normaliza e traduz um nome de proficiência da API.
 * Remove prefixos como "Skill:" e traduz termos específicos.
 * @param name O nome da proficiência vindo da API (ex: "Skill: Stealth").
 * @returns O nome da proficiência traduzido e limpo (ex: "Furtividade").
 */
export const normalizeProficiencyName = (name: string): string => {
    if (!name) return '';
    
    const lowerCaseName = name.toLowerCase();

    for (const prefix in PROFICIENCY_TYPES) {
        if (lowerCaseName.startsWith(prefix)) {
            const cleanName = name.substring(prefix.length).trim();
            return translateApiString(cleanName);
        }
    }
    return translateApiString(name);
}


/**
 * Traduz uma string comum da API (como um nome de raça, classe ou item) para Português.
 * Esta é uma função de fallback simples, a tradução principal ocorre no backend.
 * @param apiString A string em inglês da API.
 * @returns A string traduzida, se disponível; caso contrário, a string original.
 */
export const translateApiString = (apiString: string): string => {
    if (!apiString) return '';
    
    // Procura primeiro em traduções específicas
    const specific = specificTranslations[apiString.toLowerCase().replace(/ /g, '-')];
    if (specific) return specific;

    // Se não for específica, apenas retorna a string original (assumindo que o backend já traduziu).
    // Esta função serve mais como um helper para casos de consistência.
    return apiString;
};

/**
 * Traduz um nome de condição.
 * @param conditionName O nome da condição em inglês.
 * @returns O nome traduzido.
 */
export const translateCondition = (conditionName: string): string => {
    // Eventualmente, isso usaria um dicionário de traduções mais robusto.
    const translations: Record<string, string> = {
        'Blinded': 'Cego',
        'Charmed': 'Enfeitiçado',
        'Deafened': 'Ensurdecido',
        'Frightened': 'Amedrontado',
        'Grappled': 'Agarrado',
        'Incapacitated': 'Incapacitado',
        'Invisible': 'Invisível',
        'Paralyzed': 'Paralisado',
        'Petrified': 'Petrificado',
        'Poisoned': 'Envenenado',
        'Prone': 'Caído',
        'Restrained': 'Contido',
        'Stunned': 'Atordoado',
        'Unconscious': 'Inconsciente',
        'Exhaustion': 'Exaustão',
    };
    return translations[conditionName] || conditionName;
};

/**
 * Traduz um nome de atributo.
 * @param attributeKey A chave do atributo (ex: 'strength').
 * @returns O nome traduzido (ex: 'Força').
 */
export const translateAttribute = (attributeKey: string): string => {
    const translations: Record<string, string> = {
        'strength': 'Força',
        'dexterity': 'Destreza',
        'constitution': 'Constituição',
        'intelligence': 'Inteligência',
        'wisdom': 'Sabedoria',
        'charisma': 'Carisma',
    };
    return translations[attributeKey] || attributeKey;
};
