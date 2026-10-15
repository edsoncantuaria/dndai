export type EntityTier = 'HERO' | 'MAJOR' | 'SECONDARY' | 'INCIDENTAL' | 'CREATURE';

export const SIMULATION_TIER_PRIORITY: EntityTier[] = [
    'HERO',
    'MAJOR',
    'SECONDARY',
    'INCIDENTAL',
    'CREATURE',
];

export function isGoapEligibleTier(tier: EntityTier): boolean {
    return tier === 'HERO' || tier === 'MAJOR';
}
