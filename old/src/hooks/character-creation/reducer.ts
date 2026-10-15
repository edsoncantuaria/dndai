// src/hooks/character-creation/reducer.ts
import type { Attributes } from '@/types';

export interface CharacterCreatorState {
    name: string;
    sex: 'Masculino' | 'Feminino' | 'Outro';
    hairStyle: 'Careca' | 'Curto' | 'Médio' | 'Longo';
    beardStyle: 'Sem Barba' | 'Curta' | 'Grande';
    skinColor: 'Branca' | 'Parda' | 'Negra' | 'Indígena' | 'Amarela';
    race: string;
    subrace: string;
    characterClass: string;
    background: string;
    alignment: string;
    backstory: string;
    attributeMethod: 'point-buy' | 'roll' | null;
    rollSessionId: string | null;
    points: number;
    baseAttributes: Attributes;
    personalityTraits: string[];
    ideal: string;
    bond: string;
    flaw: string;
    isVariantHuman: boolean;
    variantHumanBonusSelections: (keyof Attributes)[];
    selectedFeat: string;
    draconicAncestry: string;
    
    // Novas propriedades gerenciadas pelo useSelectionManager
    proficiencySelections: Record<string, string[]>;
    equipmentSelections: Record<string, { main: number, sub: Record<number, string> }>;
    chosenClassSpells: string[];
    chosenRacialSpells: Record<string, string[]>;
    chosenLanguages: string[];
    traitSelections: Record<string, string>;
}

export const initialState: CharacterCreatorState = {
    name: '',
    sex: 'Masculino',
    hairStyle: 'Curto',
    beardStyle: 'Sem Barba',
    skinColor: 'Parda',
    race: '',
    subrace: '',
    characterClass: '',
    background: '',
    alignment: '',
    backstory: '',
    attributeMethod: null,
    rollSessionId: null,
    points: 27,
    baseAttributes: { strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 },
    personalityTraits: [],
    ideal: '',
    bond: '',
    flaw: '',
    isVariantHuman: false,
    variantHumanBonusSelections: [],
    selectedFeat: '',
    draconicAncestry: '',
    
    // Novos estados
    proficiencySelections: {},
    equipmentSelections: {},
    chosenClassSpells: [],
    chosenRacialSpells: {},
    chosenLanguages: [],
    traitSelections: {},
};

export type CharacterCreatorAction =
    | { type: 'SET_FIELD'; payload: { field: keyof CharacterCreatorState; value: any } }
    | { type: 'SET_BASE_ATTRIBUTES'; payload: Attributes }
    | { type: 'SET_POINTS'; payload: number }
    | { type: 'RESET_RACE_SELECTIONS' }
    | { type: 'RESET_PERSONALITY' }
    | { type: 'RESET_SELECTIONS'; payload: { type: 'full' | 'class' | 'background' } };


export const characterCreatorReducer = (state: CharacterCreatorState, action: CharacterCreatorAction): CharacterCreatorState => {
    switch (action.type) {
        case 'SET_FIELD':
            const { field, value } = action.payload;
            // Support for functional updates, e.g., setField('count', c => c + 1)
            if (typeof value === 'function') {
                return { ...state, [field]: value(state[field]) };
            }
            return { ...state, [field]: value };
        case 'SET_BASE_ATTRIBUTES':
            return { ...state, baseAttributes: action.payload };
        case 'SET_POINTS':
            return { ...state, points: action.payload };
        case 'RESET_RACE_SELECTIONS':
            return {
                ...state,
                subrace: '',
                isVariantHuman: false,
                variantHumanBonusSelections: [],
                selectedFeat: '',
                draconicAncestry: '',
            };
        case 'RESET_PERSONALITY':
            return {
                ...state,
                personalityTraits: [],
                ideal: '',
                bond: '',
                flaw: '',
            };
        case 'RESET_SELECTIONS':
            const { type } = action.payload;
             if (type === 'full') {
                return {
                    ...state,
                    proficiencySelections: {},
                    equipmentSelections: {},
                    chosenClassSpells: [],
                    chosenRacialSpells: {},
                    chosenLanguages: [],
                    traitSelections: {},
                };
            }
            if (type === 'class') {
                 // Reset only class-specific selections like spells.
                 return { ...state, chosenClassSpells: [] };
            }
             if (type === 'background') {
                // Resetting personality traits is handled separately,
                // but other background-specific selections could be reset here.
            }
            return state;
        default:
            return state;
    }
};
