// src/hooks/character-creation/types.ts
import type { Attributes } from '@/types';
import type { CharacterCreatorState } from './reducer';

export type Action =
    | { type: 'SET_FIELD'; payload: { field: keyof CharacterCreatorState; value: any } }
    | { type: 'SET_BASE_ATTRIBUTES'; payload: Attributes }
    | { type: 'SET_POINTS'; payload: number }
    | { type: 'RESET_RACE_SELECTIONS' }
    | { type: 'RESET_PERSONALITY' };
