// src/utils/translator.ts

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
    'Rock Gnome': 'Gnomo da Rocha',
    'Lightfoot Halfling': 'Pés Leves',

    // Content Types
    'race': 'Raça',
    'class': 'Classe',
    'subclass': 'Subclasse',
    'spell': 'Magia',
    'item': 'Item',
    'monster': 'Monstro',
    'background': 'Antecedente',
    'feat': 'Talento',


    // Classes
    'Barbarian': 'Bárbaro',
    'Bard': 'Bardo',
    'Cleric': 'Clérigo',
    'Druid': 'Druida',
    'Fighter': 'Guerreiro',
    'Monk': 'Monge',
    'Paladin': 'Paladino',
    'Ranger': 'Patrulheiro',
    'Rogue': 'Ladino',
    'Sorcerer': 'Feiticeiro',
    'Warlock': 'Bruxo',
    'Wizard': 'Mago',

    // Subclasses
    'Berserker': 'Berserker',
    'Lore': 'do Conhecimento',
    'Life': 'da Vida',
    'Land': 'da Terra',
    'Champion': 'Campeão',
    'Open Hand': 'Mão Aberta',
    'Devotion': 'da Devoção',
    'Hunter': 'Caçador',
    'Thief': 'Ladrão',
    'Draconic': 'Dracônico',
    'Fiend': 'O Ínfero',
    'Evocation': 'da Evocação',


    // Alignments
    'Lawful Good': 'Leal e Bom',
    'Neutral Good': 'Neutro e Bom',
    'Chaotic Good': 'Caótico e Bom',
    'Lawful Neutral': 'Leal e Neutro',
    'True Neutral': 'Neutro',
    'Neutral': 'Neutro',
    'Chaotic Neutral': 'Caótico e Neutro',
    'Lawful Evil': 'Leal e Mau',
    'Neutral Evil': 'Neutro e Mau',
    'Chaotic Evil': 'Caótico e Mau',
    
    // Skills & Proficiencies
    'Acrobatics': 'Acrobacia',
    'Animal Handling': 'Adestrar Animais',
    'Arcana': 'Arcanismo',
    'Athletics': 'Atletismo',
    'Deception': 'Enganação',
    'History': 'História',
    'Insight': 'Intuição',
    'Intimidation': 'Intimidação',
    'Investigation': 'Investigação',
    'Medicine': 'Medicina',
    'Nature': 'Natureza',
    'Perception': 'Percepção',
    'Performance': 'Atuação',
    'Persuasion': 'Persuasão',
    'Religion': 'Religião',
    'Sleight of Hand': 'Prestidigitação',
    'Stealth': 'Furtividade',
    'Survival': 'Sobrevivência',
    'Skill: Acrobatics': 'Acrobacia',
    'Skill: Animal Handling': 'Adestrar Animais',
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
    'Light Armor': 'Armaduras Leves',
    'Medium Armor': 'Armaduras Médias',
    'Heavy Armor': 'Armaduras Pesadas',
    'All armor': 'Todas as Armaduras',
    'Shields': 'Escudos',
    'Simple Weapons': 'Armas Simples',
    'Martial Weapons': 'Armas Marciais',
    'Battleaxes': 'Machados de Batalha',
    'Handaxes': 'Machadinhas',
    'Throwing hammers': 'Martelos de Arremesso',
    'Warhammers': 'Martelos de Guerra',
    'Disguise Kit': 'Kit de Disfarce',
    'Poisoner\'s Kit': 'Kit de Venenos',
    'Thieves\' Tools': 'Ferramentas de Ladrão',
    'Artificer\'s Lore': 'Conhecimento de Artífice',
    'Brave': 'Bravura',
    'Breath Weapon': 'Arma de Sopro',
    'Damage Resistance': 'Resistência a Dano',
    'Darkvision': 'Visão no Escuro',
    'Draconic Ancestry': 'Ancestralidade Dracônica',
    'Draconic Ancestry (Black)': 'Ancestralidade Dracônica (Preto)',
    'Draconic Ancestry (Blue)': 'Ancestralidade Dracônica (Azul)',
    'Draconic Ancestry (Brass)': 'Ancestralidade Dracônica (Latão)',
    'Draconic Ancestry (Bronze)': 'Ancestralidade Dracônica (Bronze)',
    'Draconic Ancestry (Copper)': 'Ancestralidade Dracônica (Cobre)',
    'Draconic Ancestry (Gold)': 'Ancestralidade Dracônica (Ouro)',
    'Draconic Ancestry (Green)': 'Ancestralidade Dracônica (Verde)',
    'Draconic Ancestry (Red)': 'Ancestralidade Dracônica (Vermelho)',
    'Draconic Ancestry (Silver)': 'Ancestralidade Dracônica (Prata)',
    'Draconic Ancestry (White)': 'Ancestralidade Dracônica (Branco)',
    'Dwarven Combat Training': 'Treinamento de Combate Anão',
    'Dwarven Resilience': 'Resiliência Anã',
    'Dwarven Toughness': 'Resistência Anã',
    'Elf Weapon Training': 'Treinamento com Armas Élficas',
    'Extra Language': 'Idioma Extra',
    'Fey Ancestry': 'Ancestralidade Feérica',
    'Gnome Cunning': 'Astúcia Gnômica',
    'Halfling Nimbleness': 'Agilidade Halfling',
    'Hellish Resistance': 'Resistência Infernal',
    'High Elf Cantrip': 'Truque de Alto Elfo',
    'Infernal Legacy': 'Legado Infernal',
    'Keen Senses': 'Sentidos Aguçados',
    'Lucky': 'Sortudo',
    'Menacing': 'Ameaçador',
    'Naturally Stealthy': 'Furtividade Natural',
    'Relentless Endurance': 'Resistência Implacável',
    'Savage Attacks': 'Ataques Selvagens',
    'Skill Versatility': 'Versatilidade em Perícia',
    'Stonecunning': 'Astúcia da Pedra',
    'Tinker': 'Engenhoso',
    'Tool Proficiency': 'Proficiência em Ferramenta',
    'Trance': 'Transe',
    'Breath Weapon (Acid)': 'Arma de Sopro (Ácido)',
    'Breath Weapon (Lightning)': 'Arma de Sopro (Elétrico)',
    'Breath Weapon (Fire)': 'Arma de Sopro (Fogo)',
    'Breath Weapon (Cold)': 'Arma de Sopro (Frio)',
    'Breath Weapon (Poison)': 'Arma de Sopro (Veneno)',


    // Backgrounds
    'Acolyte': 'Acólito',
    'Criminal': 'Criminoso',
    'Folk Hero': 'Herói do Povo',
    'Noble': 'Nobre',
    'Sage': 'Sábio',
    'Soldier': 'Soldado',


    // Equipment Categories from getOptionLabel
    'Martial Melee Weapons': 'Arma Marcial Corpo a Corpo',
    'Simple Weapons': 'Arma Simples',
    'Holy Symbols': 'Símbolo Sagrado',
    'Druidic Foci': 'Foco Druídico',
    'Arcane Foci': 'Foco Arcano',
    'Adventuring Gear': 'Equipamento de Aventura',
    'Musical Instruments': 'Instrumento Musical',
    
    // Spells
    'Mage Hand': 'Mão Mágica',
    'Light': 'Luz',
    'Fire Bolt': 'Raio de Fogo',
    'Magic Missile': 'Míssil Mágico',
    'Cure Wounds': 'Curar Ferimentos',
    'Guiding Bolt': 'Raio Guiado',

    // Magic Schools
    'Abjuration': 'Abjuração',
    'Conjuration': 'Conjuração',
    'Divination': 'Adivinhação',
    'Enchantment': 'Encantamento',
    'Evocation': 'Evocação',
    'Illusion': 'Ilusão',
    'Necromancy': 'Necromancia',
    'Transmutation': 'Transmutação',

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
    'Halfling': 'Halfling',
    'Orc': 'Orc',
    'Abyssal': 'Abissal',
    'Celestial': 'Celestial',
    'Draconic': 'Dracônico',
    'Infernal': 'Infernal',
    'Undercommon': 'Subcomum',
    'Sylvan': 'Silvestre',
    'Deep Speech': 'Linguagem Profunda',
    'Primordial': 'Primordial',
    
    // World State
    'Clear': 'Céu Limpo',
    'Light Clouds': 'Nuvens Leves',
    'Overcast': 'Nublado',
    'Rain': 'Chuva',
    'Storm': 'Tempestade',
    'Snow': 'Neve',
    'Blizzard': 'Nevasca',
    'Fog': 'Nevoeiro',
    'Morning': 'Manhã',
    'Day': 'Dia',
    'Afternoon': 'Tarde',
    'Night': 'Noite',
    'Dusk': 'Crepúsculo',
    'Dawn': 'Alvorecer',
};

export const translateApiString = (s?: string): string => {
    if (!s) return '';
    return TRANSLATIONS[s] || s;
};

export const normalizeProficiencyName = (name: string): string => {
    if (!name) return '';
    
    if (name.startsWith('Skill: ')) {
        const skillName = name.substring(7);
        return TRANSLATIONS[skillName] || skillName;
    }
     if (name.startsWith('Saving Throw: ')) {
        const attr = name.substring(14);
        return `Resistência: ${attr}`;
    }
   
    const chooseMatch = name.match(/Choose (\w+) from (.+)/);
    if (chooseMatch) {
        const numberWord = chooseMatch[1];
        let number;
        switch(numberWord.toLowerCase()) {
            case 'one': number = 'uma'; break;
            case 'two': number = 'duas'; break;
            case 'three': number = 'três'; break;
            default: number = numberWord;
        }

        const options = chooseMatch[2].split(', ').map(opt => TRANSLATIONS[opt.trim()] || opt.trim());
        return `Escolha ${number} entre: ${options.join(', ')}`;
    }

    return TRANSLATIONS[name] || name;
};

export const translateAttribute = (s: keyof typeof TRANSLATIONS): string => translateApiString(s);
export const translateMagicSchool = (s?: string): string => translateApiString(s);
export const translateCondition = (s?: string): string => translateApiString(s);
export const translateLanguage = (s?: string): string => translateApiString(s);


