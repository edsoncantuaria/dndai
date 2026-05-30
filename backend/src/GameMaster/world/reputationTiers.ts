export type ReputationTierId =
    | 'despised'
    | 'hostile'
    | 'wary'
    | 'neutral'
    | 'noted'
    | 'respected'
    | 'renowned';

export type ReputationTier = {
    id: ReputationTierId;
    label: string;
    min: number;
    max: number;
};

export const REPUTATION_TIERS: ReputationTier[] = [
    { id: 'despised', label: 'Desprezado', min: -100, max: -60 },
    { id: 'hostile', label: 'Hostil', min: -59, max: -20 },
    { id: 'wary', label: 'Desconfiado', min: -19, max: -5 },
    { id: 'neutral', label: 'Neutro', min: -4, max: 4 },
    { id: 'noted', label: 'Notado', min: 5, max: 19 },
    { id: 'respected', label: 'Respeitado', min: 20, max: 49 },
    { id: 'renowned', label: 'Renomado', min: 50, max: 100 },
];

export function clampReputationScore(score: number): number {
    return Math.max(-100, Math.min(100, Math.round(score)));
}

export function scoreToReputationTier(score: number): ReputationTier {
    const clamped = clampReputationScore(score);
    return (
        REPUTATION_TIERS.find(t => clamped >= t.min && clamped <= t.max) ??
        REPUTATION_TIERS.find(t => t.id === 'neutral')!
    );
}
