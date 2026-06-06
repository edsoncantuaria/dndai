import { apiClient } from './apiClient';
import type { Attributes } from '@/types';

export type CharacterAttributeRollResponse = {
    rollSessionId: string;
    baseAttributes: Attributes;
    rolls: Array<{
        attribute: keyof Attributes;
        dice: [number, number, number, number];
        kept: [number, number, number];
        total: number;
    }>;
};

export async function rollCharacterAttributes(): Promise<CharacterAttributeRollResponse> {
    return apiClient<CharacterAttributeRollResponse>('/v2/characters/roll-attributes', {
        method: 'POST',
    });
}
