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
};

export type CharacterCreatorAction =
    | { type: 'SET_FIELD'; payload: { field: keyof CharacterCreatorState; value: any } }
    | { type: 'SET_BASE_ATTRIBUTES'; payload: Attributes }
    | { type: 'SET_POINTS'; payload: number }
    | { type: 'RESET_RACE_SELECTIONS' }
    | { type: 'RESET_PERSONALITY' };


export const characterCreatorReducer = (state: CharacterCreatorState, action: CharacterCreatorAction): CharacterCreatorState => {
    switch (action.type) {
        case 'SET_FIELD':
            const { field, value } = action.payload;
            // If the field is a function, it's a state updater function (like from useState)
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
        default:
            return state;
    }
};
