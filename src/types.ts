// types.ts

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
            options: {
                item: ApiListItem;
                option_type: string;
            }[];
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
    race: string;
    subrace: string | null;
    characterClass: string;
    background: string;
    alignment: string;
    attributes: Attributes;
    proficiencies: Proficiency[];
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
    // Weapon properties
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
    // Armor properties
    armor_category?: string;
    armor_class?: {
        base: number;
        dex_bonus: boolean;
        max_bonus: number | null;
    };
    str_minimum?: number;
    stealth_disadvantage?: boolean;
}

export interface ShopItem extends InventoryItem {
    cost: {
        quantity: number;
        unit: string;
    };
}

export interface Character {
    name: string;
    level: number;
    xp: number;
    xpToNextLevel: number;
    race: string;
    subrace: string | null;
    characterClass: string;
    subclass: string | null;
    hitDie: number;
    background: string;
    alignment: string;
    attributes: Attributes;
    modifiers: Attributes;
    proficiencyBonus: number;
    proficiencies: Proficiency[];
    languages: string[];
    hp: {
        current: number;
        max: number;
        temp: number;
    };
    ac: {
        value: number;
        source: string;
    };
    inventory: InventoryItem[];
    currency: {
        gp: number;
        sp: number;
        cp: number;
    };
    currentWeight: number;
    carryingCapacity: number;
    spellSlots: {
        [key: string]: { current: number; max: number };
    };
    spells: string[];
    feats: Feat[];
    backstory: string;
    personalityTraits: string[];
    ideal: string;
    bond: string;
    flaw: string;
    deathSaves: {
        successes: number;
        failures: number;
    };
    conditions: ApiCondition[];
    relationships: Relationship[];
    journal: JournalEntryLocation[];
    currentRegion: string;
    storySoFar?: string;
    hitDice: {
        current: number;
        total: number;
    };
    speed: number;
    classLevelsData: ApiClassLevel[];
    subclassLevelsData?: ApiClassLevel[];
}

export interface LogEntry {
    id: string;
    type: 'narration' | 'action' | 'system' | 'combat' | 'insight' | 'roll';
    content: string;
    rollResult?: {
        description: string;
        dice: string;
        modifier: number;
        total: number;
        rolls: number[];
        success?: boolean;
        dc?: number;
        rollType: 'check' | 'save' | 'attack' | 'damage';
        advantage?: boolean;
        disadvantage?: boolean;
    };
}

export interface Combatant {
    id: string;
    name: string;
    hp?: number;
    maxHp?: number;
    initiative: number;
}

export interface CombatState {
    isActive: boolean;
    round: number;
    turn: number;
    combatants: Combatant[];
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
    concentration: boolean;
    casting_time: string;
    level: number;
    attack_type?: string;
    damage?: {
        damage_type: ApiListItem;
        [key: string]: any;
    };
    school: ApiListItem;
    classes: ApiListItem[];
    subclasses: ApiListItem[];
}

export interface ApiTrait {
    index: string;
    races: ApiListItem[];
    subraces: ApiListItem[];
    name: string;
    desc: string[];
    proficiencies: Proficiency[];
    proficiency_choices?: ProficiencyChoice;
    trait_specific?: {
        spell_options?: ProficiencyChoice;
        subfeature_options?: ProficiencyChoice;
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

export interface ShopState {
    isOpen: boolean;
    isHaggling: boolean;
    name: string;
    inventory: ShopItem[];
    sellPrices: Record<string, number>; // maps item ID to sell price
}

export interface LootOffer {
    items: InventoryItem[];
    currency: {
        gp: number;
    }
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
    status: 'active' | 'completed';
    objectives: string[];
}

export interface Relationship {
    npcId: string;
    name: string;
    description: string;
    status: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'ally';
    affinity: number; // Value from -100 to 100
    quests: Quest[];
}

export interface JournalEntryLocation {
    id: string;
    name: string;
    region: string;
    summary: string;
    looted: boolean;
    subLocations?: JournalEntryLocation[];
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