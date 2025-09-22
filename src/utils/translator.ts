
export const TRANSLATIONS: Record<string, string> = {
    // Attributes
    'strength': 'Força',
    'dexterity': 'Destreza',
    'constitution': 'Constituição',
    'intelligence': 'Inteligência',
    'wisdom': 'Sabedoria',
    'charisma': 'Carisma',

    // Races
    'Dragonborn': 'Draconato',
    'Dwarf': 'Anão',
    'Elf': 'Elfo',
    'Gnome': 'Gnomo',
    'Half-Elf': 'Meio-Elfo',
    'Halfling': 'Halfling',
    'Half-Orc': 'Meio-Orc',
    'Human': 'Humano',
    'Tiefling': 'Tiefling',
    'Hill Dwarf': 'Anão da Colina',
    'High Elf': 'Alto Elfo',

    // Classes
    'Barbarian': 'Bárbaro',
    'Bard': 'Bardo',
    'Cleric': 'Clérigo',
    'Druid': 'Druida',
    'Fighter': 'Guerreiro',
    'Monk': 'Monge',
    'Paladin': 'Paladino',
    'Ranger': 'Ranger',
    'Rogue': 'Ladino',
    'Sorcerer': 'Feiticeiro',
    'Warlock': 'Bruxo',
    'Wizard': 'Mago',

    // Alignments
    'Lawful Good': 'Leal e Bom',
    'Neutral Good': 'Neutro e Bom',
    'Chaotic Good': 'Caótico e Bom',
    'Lawful Neutral': 'Leal e Neutro',
    'True Neutral': 'Neutro',
    'Chaotic Neutral': 'Caótico e Neutro',
    'Lawful Evil': 'Leal e Mau',
    'Neutral Evil': 'Neutro e Mau',
    'Chaotic Evil': 'Caótico e Mau',
    
    // Skills & Proficiencies
    'Skill: Acrobatics': 'Acrobacia',
    'Skill: Animal Handling': 'Trato com Animais',
    'Skill: Arcana': 'Arcanismo',
    'Skill: Athletics': 'Atletismo',
    'Skill: Deception': 'Enganação',
    'Skill: History': 'História',
    'Skill: Insight': 'Intuição',
    'Skill: Intimidation': 'Intimidação',
    'Skill: Investigation': 'Investigação',
    'Skill: Medicine': 'Medicina',
    'Skill: Nature': 'Natureza',
    'Skill: Perception': 'Percepção',
    'Skill: Performance': 'Atuação',
    'Skill: Persuasion': 'Persuasão',
    'Skill: Religion': 'Religião',
    'Skill: Sleight of Hand': 'Prestidigitação',
    'Skill: Stealth': 'Furtividade',
    'Skill: Survival': 'Sobrevivência',
    'Saving Throw: STR': 'Resistência: FOR',
    'Saving Throw: DEX': 'Resistência: DES',
    'Saving Throw: CON': 'Resistência: CON',
    'Saving Throw: INT': 'Resistência: INT',
    'Saving Throw: WIS': 'Resistência: SAB',
    'Saving Throw: CHA': 'Resistência: CAR',

    // Equipment & Items
    'A simple puzzle box': 'Uma caixa de quebra-cabeça simples',
    'A trophy from an animal you killed': 'Um troféu de um animal que você matou',
    'Light Crossbow': 'Besta Leve',
    'Dagger': 'Adaga',
    'Shortsword': 'Espada Curta',
    'Longsword': 'Espada Longa',
    'Leather Armor': 'Armadura de Couro',
    'Shield': 'Escudo',
    'Explorer\'s Pack': 'Pacote de Explorador',
    'Dungeoneer\'s Pack': 'Pacote de Aventureiro',
    'Holy Symbol': 'Símbolo Sagrado',
    
    // Spells
    'Mage Hand': 'Mão Mágica',
    'Light': 'Luz',
    'Fire Bolt': 'Raio de Fogo',
    'Magic Missile': 'Míssil Mágico',
    'Cure Wounds': 'Curar Ferimentos',
    'Guiding Bolt': 'Raio Guiado',

    // Magic Schools
    'abjuration': 'Abjuração',
    'conjuration': 'Conjuração',
    'divination': 'Adivinhação',
    'enchantment': 'Encantamento',
    'evocation': 'Evocação',
    'illusion': 'Ilusão',
    'necromancy': 'Necromancia',
    'transmutation': 'Transmutação',

    // Conditions
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

    // Languages
    'Common': 'Comum',
    'Dwarvish': 'Anão',
    'Elvish': 'Élfico',
    'Giant': 'Gigante',
    'Gnomish': 'Gnômico',
    'Goblin': 'Goblin',
    'Orc': 'Orc',
    'Abyssal': 'Abissal',
    'Celestial': 'Celestial',
    'Draconic': 'Dracônico',
    'Infernal': 'Infernal',
};

export const translateApiString = (s?: string): string => {
    if (!s) return '';
    return TRANSLATIONS[s] || s;
};


export const normalizeProficiencyName = (name: string): string => {
    // The dictionary keys are the full proficiency names (e.g., "Skill: Acrobatics").
    // The values are the clean, translated names (e.g., "Acrobacia").
    // The previous implementation incorrectly stripped the prefix before translation,
    // causing the dictionary lookup to fail.
    // The fix is to simply translate the full name directly.
    return translateApiString(name);
};

export const translateAttribute = (s: keyof typeof TRANSLATIONS): string => translateApiString(s);
export const translateEquipment = (s?: string): string => translateApiString(s);
export const translateSpell = (s?: string): string => translateApiString(s);
export const translateMagicSchool = (s?: string): string => translateApiString(s);
export const translateCondition = (s?: string): string => translateApiString(s);
export const translateLanguage = (s?: string): string => translateApiString(s);
