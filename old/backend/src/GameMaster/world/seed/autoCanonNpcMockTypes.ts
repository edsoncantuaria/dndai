import type { EntityTier } from '../../database/entities/types/EntityTier.js';
import type { NpcAtributosPt } from '../npcSheet.js';

/** Entrada de mock — autoria Cursor Auto (`data/penai-seed/auto-canon-npcs/`). */
export type AutoCanonNpcMockEntry = {
    givenName: string;
    roleTitle: string;
    role: string;
    description: string;
    goal: string;
    tier: EntityTier;
    maxHp?: number;
    level?: number;
    armorClass?: number;
    atributos: NpcAtributosPt;
    characterClass: 'fighter' | 'rogue' | 'wizard' | 'cleric' | 'bard' | 'commoner';
    isSpellcaster: boolean;
    spells?: string[];
    mainWeaponSlug?: string;
};

export type AutoCanonNpcMockFile = {
    regionSlug: string;
    regionName: string;
    source: 'cursor-auto';
    generatedAt?: string;
    npcs: AutoCanonNpcMockEntry[];
};
