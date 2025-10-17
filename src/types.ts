// types.ts
// Este arquivo será eventualmente substituído por tipos gerados diretamente
// a partir dos schemas Zod do backend para garantir consistência.

export interface PlayerRollRequest {
    reason: string;
    dice: string;
    modifier: number;
    dc?: number;
    rollType: 'check' | 'save' | 'attack' | 'damage' | 'initiative';
    advantage?: boolean;
    disadvantage?: boolean;
}

export type ImageLogEntryContent = {
    status: 'generating' | 'failed' | 'done';
    url?: string;
    prompt?: string;
};


export interface GameMasterResponse {
    logEntries?: LogEntry[];
    actionOptions?: (string | { text: string; action: string, skill?: string })[];
    updatedCharacter?: Partial<Character>;
    combatState?: CombatState;
    levelUpState?: LevelUpState;
    shopState?: ShopState;
    lootOffer?: LootOffer;
    useHitDiceRequest?: UseHitDiceRequest;
    ambientSound?: string;
    imagePrompt?: string;
    systemLog?: string;
    worldState?: { [key: string]: any };
}


export interface ApiListItem {
    index: string;
    name: string;
    url: string;
}

export interface ApiRace {
    index: string;
    name: string;
    speed: number;
    ability_bonuses: {
        ability_score: ApiListItem;
        bonus: number;
    }[];
    ability_bonus_options?: ProficiencyChoice;
    alignment: string;
    age: string;
    size: string;
    size_description: string;
    starting_proficiencies: Proficiency[];
    starting_proficiency_options?: ProficiencyChoice;
    languages: ApiListItem[];
    language_desc: string;
    language_options?: {
        choose: number;
        from: {
             option_set_type: string;
             options: any[];
        }
    };
    traits: ApiListItem[];
    subraces: ApiListItem[];
}

export interface ApiSubrace {
    index: string;
    name: string;
    race: ApiListItem;
    desc: string;
    ability_bonuses: {
        ability_score: ApiListItem;
        bonus: number;
    }[];
    starting_proficiencies: Proficiency[];
    languages: ApiListItem[];
    racial_traits: ApiListItem[];
    starting_proficiency_options?: ProficiencyChoice;
}

export interface ApiClass {
    index: string;
    name: string;
    hit_die: number;
    proficiency_choices: ProficiencyChoice[];
    proficiencies: Proficiency[];
    saving_throws: ApiListItem[];
    starting_equipment: {
        equipment: ApiListItem;
        quantity: number;
    }[];
    starting_equipment_options: ProficiencyChoice[];
    class_levels: string;
    multi_classing: any;
    subclasses: ApiListItem[];
    spellcasting?: {
        level: number;
        spellcasting_ability: ApiListItem;
        info: { name: string; desc: string[] }[];
    };
}


export interface ApiBackground {
    index: string;
    name: string;
    starting_proficiencies: Proficiency[];
    language_options: {
        choose: number;
        from: {
             option_set_type: string;
             options: any[];
        }
    };
    starting_equipment: {
        equipment: ApiListItem;
        quantity: number;
    }[];
    starting_equipment_options: ProficiencyChoice[];
    feature: {
        name: string;
        desc: string[];
    };
    personality_traits: ProficiencyChoice;
    ideals: ProficiencyChoice;
    bonds: ProficiencyChoice;
    flaws: ProficiencyChoice;
}

export interface Proficiency {
    index: string;
    name: string;
    url: string;
}

export interface ProficiencyChoice {
    desc: string;
    choose: number;
    type: string;
    from: {
        option_set_type: string;
        options: ApiEquipmentOption[];
        equipment_category?: ApiListItem;
    };
}

export interface ApiEquipmentOption {
    option_type: string;
    desc?: string;
    of?: ApiListItem;
    count?: number;
    type?: string;
    from?: any;
    choice?: any;
    items?: ApiEquipmentOption[];
    item?: ApiListItem;
}


export interface NewCharacterInfo {
    name: string;
    sex: 'Masculino' | 'Feminino' | 'Outro';
    hairStyle: 'Careca' | 'Curto' | 'Médio' | 'Longo';
    beardStyle: 'Sem Barba' | 'Curta' | 'Grande';
    skinColor: 'Branca' | 'Parda' | 'Negra' | 'Indígena' | 'Amarela';
    race: string;
    subrace: string | null;
    draconicAncestry?: string;
    characterClass: string;
    subclassFlavor: string | null;
    background: string;
    alignment: string;
    attributes: Attributes;
    proficiencies: Proficiency[];
    traits: ApiListItem[];
    languages: string[];
    inventory: InventoryItem[];
    spells: string[];
    backstory: string;
    personalityTraits: string[];
    ideal: string;
    bond: string;
    flaw: string;
    feats: Feat[];
    hitDie: number;
    subclass: string | null;
    level?: number;
    homebrewIds?: string[];
}

export interface InventoryItem {
    id: string;
    index: string;
    name: string;
    quantity: number;
    equipped: boolean;
    cost?: {
        quantity: number;
        unit: string;
    };
    weight?: number;
    desc?: string[];
    weapon_category?: string;
    weapon_range?: string;
    category_range?: string;
    damage?: {
        damage_dice: string;
        damage_type: ApiListItem;
    };
    two_handed_damage?: {
        damage_dice: string;
        damage_type: ApiListItem;
    };
    properties?: ApiListItem[];
    armor_category?: string;
    armor_class?: {
        base: number;
        dex_bonus: boolean;
        max_bonus: number | null;
    };
    str_minimum?: number;
    stealth_disadvantage?: boolean;
    consumable?: boolean;
    usable?: boolean;
    recoverable?: boolean;
    restrictions?: string[];
    itemData?: any; // Para compatibilidade com o backend
}

export interface ShopItem extends InventoryItem {
    cost: {
        quantity: number;
        unit: string;
    };
}

export interface LootOffer {
    items: InventoryItem[];
    currency: {
        gp: number;
    }
}

export interface Character {
    id: number;
    userId: number;
    name: string;
    race: string;
    subrace: string | null;
    characterClass: string;
    level: number;
    background: string;
    alignment: string;
    backstory: string;
    ideal: string;
    bond: string;
    flaw: string;
    sex: string;
    hairStyle: string;
    beardStyle: string;
    skinColor: string;
    attributes: CharacterAttributes; // Relação OneToOne
    proficiencies: CharacterProficiency[]; // Relação OneToMany
    inventory: InventoryItem[]; // Relação OneToMany mapeada de `items`
    spells: CharacterSpell[]; // Relação OneToMany
    journal: JournalEntry[]; // Relação OneToMany
    relationships: Relationship[]; // Relação OneToMany
    storySoFar?: string;
    factionReputation?: Record<string, number>;
    worldState?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
    personalityTraits: string[];
    draconicAncestry?: string;
    homebrewContentIds?: string[];

    // Campos que podem ser calculados ou precisam ser mantidos no estado do frontend
    modifiers: Attributes;
    proficiencyBonus: number;
    hp: { current: number, max: number, temp: number };
    ac: { value: number, source: string };
    xp: number;
    xpToNextLevel: number;
    hitDie: number;
    hitDice: { current: number, total: number };
    speed: number;
    deathSaves: { successes: number; failures: number };
    conditions: ApiCondition[];
    currency: { gp: number, sp: number, cp: number };
    currentWeight: number;
    carryingCapacity: number;
    spellSlots: { [key: string]: { current: number; max: number } };
    classLevelsData: ApiClassLevel[];
    subclassLevelsData?: ApiClassLevel[];
    traits: ApiListItem[];
    feats: Feat[];
    languages: string[];
    subclassFlavor: string | null;
    currentRegion?: string;
}

export interface CharacterAttributes extends Attributes {
    id: number;
    characterId: number;
    hp?: number; // Para compatibilidade com o backend
    ac?: number; // Para compatibilidade com o backend
    conditions?: any[]; // Para compatibilidade com o backend
}

export interface CharacterProficiency {
    id: number;
    characterId: number;
    name: string;
    type: string;
    index: string;
    url?: string; // Para compatibilidade
}

export interface CharacterSpell {
    id: number;
    characterId: number;
    spellName: string;
}

export interface LogEntry {
    id: string;
    type: 'narration' | 'action' | 'system' | 'combat' | 'insight' | 'roll' | 'image';
    content: any; // Can be string or ImageLogEntryContent
    rollResult?: {
        description: string;
        dice: string;
        modifier: number;
        total: number;
        rolls: number[];
        success?: boolean;
        dc?: number;
        rollType: 'check' | 'save' | 'attack' | 'damage' | 'initiative';
        advantage?: boolean;
        disadvantage?: boolean;
    };
    response?: string; // Para compatibilidade com o backend
    prompt?: string; // Para compatibilidade com o backend
    timestamp?: string; // Para compatibilidade com o backend
};

export interface Combatant {
    id: string;
    name: string;
    isPlayer?: boolean;
    hp?: { current: number; max: number };
    maxHp?: number; // compatibilidade
    ac?: number;
    initiative?: number;
    initiativeRoll?: number;
    conditions?: string[];
    distance?: number;
    hasMoved: boolean;
    hasActed: boolean;
    actionPoints: number;
    bonusActionPoints: number;
    isDead: boolean;
    readyAction?: string;
    tempModifiers?: any;
    rollHistory?: any[];
}

export interface CombatState {
    isActive: boolean;
    round: number;
    turn: number;
    combatants: Combatant[];
    initiativeOrder?: (string | { id: string; initiative: number; })[];
    log?: any[];
    globalConditions?: any[];
}


export interface ApiClassLevel {
    level: number;
    ability_score_bonuses: number;
    prof_bonus: number;
    features: ApiListItem[];
    spellcasting?: {
        [key: string]: number;
    };
    class_specific?: any;
    index: string;
    class: ApiListItem;
    subclass?: ApiListItem;
    url: string;
}

export interface ApiSpell {
    index: string;
    name: string;
    desc: string[];
    higher_level: string[];
    range: string;
    components: string[];
    material: string;
    ritual: boolean;
    duration: string;
    casting_time: string;
    level: number;
    attack_type?: string;
    damage?: {
        damage_type: ApiListItem;
        damage_at_character_level?: Record<string, string>;
        [key: string]: any;
    };
    school: ApiListItem;
    classes: ApiListItem[];
    subclasses: ApiListItem[];
dc?: {
        dc_type: ApiListItem;
        dc_success: string;
    }
}

export interface ApiTrait {
    index: string;
    races: ApiListItem[];
    subraces: ApiListItem[];
    name: string;
    desc: string[];
    proficiencies: Proficiency[];
    proficiency_choices?: ProficiencyChoice;
    parent?: ApiListItem;
    trait_specific?: {
        spell_options?: ProficiencyChoice;
        subfeature_options?: ProficiencyChoice;
        damage_type?: ApiListItem;
        breath_weapon?: {
            name: string;
            desc: string;
            area_of_effect: {
                size: number;
                type: string;
            };
            usage: {
                type: string;
                times: number;
            };
            dc: {
                dc_type: ApiListItem;
                success_type: string;
            };
            damage: {
                damage_type: ApiListItem;
                damage_at_character_level: Record<string, string>;
            }[];
        };
        [key: string]: any;
    }
}

export interface LevelUpState {
    isPending: boolean;
    newLevel: number;
    choices: {
        asi?: {
            count: number;
        };
        spellsToChoose?: number;
        spellChoiceOptions?: ApiListItem[];
        featureChoices?: {
            id: string;
            desc: string;
            choose: number;
            options: { index: string; name: string; desc: string }[];
        }[];
        subclassChoice?: {
            id: string;
            desc: string;
            options: ApiListItem[];
        };
    };
}

export interface LevelUpSelections {
    attributes?: Partial<Attributes>;
    spells?: string[];
    featureChoices?: { id: string; selections: string[] }[];
    subclass?: string;
    hpIncrease?: number;
}

export interface UseHitDiceRequest {
    maxDice: number;
    hitDieValue: number;
}


export interface ApiEquipment {
    index: string;
    name: string;
    equipment_category: ApiListItem;
}

export interface ApiCondition {
    index: string;
    name: string;
    desc: string[];
    url: string;
}

export interface ApiFeature {
    index: string;
    name: string;
    level: number;
    class: ApiListItem;
    subclass: ApiListItem;
    desc: string[];
}

export interface Quest {
    id: string;
    title: string;
    status: 'active' | 'completed' | 'failed';
    objectives: string[];
    relationshipId?: number;
}

export interface Relationship {
    id: number;
    characterId: number;
    npcId: string;
    name: string;
    description: string;
    status: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'ally';
    affinity: number; // Value from -100 to 100
    quests: Quest[];
}

export interface JournalEntry {
    id: string;
    characterId: number;
    name: string;
    region: string;
    summary: string;
    looted: boolean;
    subLocations?: JournalEntry[];
    parentLocation?: JournalEntry;
}

export interface ApiSubclass {
    index: string;
    class: ApiListItem;
    name: string;
    subclass_flavor: string;
    desc: string[];
    subclass_levels: string; // URL
    spells?: {
        prerequisites: ApiListItem[];
        spell: ApiListItem;
    }[];
}

export interface Feat {
    index: string;
    name: string;
    prerequisites: {
        ability_score: ApiListItem;
        minimum_score: number;
    }[];
    desc: string[];
    url: string;
}

export type Attributes = {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
};

// Nova interface para representar uma sessão de jogo
export interface SessaoIA {
  id: number;
  nome: string;
  userId: number;
  characterId: number | null;
  character?: {
    id: number;
    name: string;
    level: number;
    characterClass: string;
    subclassFlavor: string;
    race: string;
  };
  logs?: LogEntry[];
  createdAt: string;
  updatedAt: string;
}
