// backend/src/data/enemyTemplates.ts
export type EnemyTemplateDefinition = {
    id: string;
    name: string;
    stats: {
        str?: number;
        dex?: number;
        con?: number;
        int?: number;
        wis?: number;
        cha?: number;
    };
    hitPoints?: number;
    armorClass?: number;
    actionPoints?: number;
    bonusActionPoints?: number;
    damageProfile?: {
        dice: string;
        type?: string;
        average?: number;
        notes?: string;
    };
    tags?: string[];
};

export const normalizeTemplateSlug = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') return null;
    const normalized = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    if (!normalized) return null;
    return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
};

export const DEFAULT_ENEMY_TEMPLATES: EnemyTemplateDefinition[] = [
    {
        id: 'golem-vigia',
        name: 'Golem Vigia',
        stats: { str: 20, dex: 8, con: 18, int: 6, wis: 14, cha: 8 },
        hitPoints: 120,
        armorClass: 18,
        actionPoints: 1,
        bonusActionPoints: 0,
        damageProfile: {
            dice: '2d10+5',
            type: 'força',
            average: 16,
            notes: 'Golpe massivo com punhos rúnicos.',
        },
        tags: ['constructo', 'guardiao'],
    },
    {
        id: 'fragmento-arcano',
        name: 'Fragmento Arcano',
        stats: { str: 6, dex: 16, con: 12, int: 10, wis: 12, cha: 8 },
        hitPoints: 22,
        armorClass: 14,
        actionPoints: 1,
        bonusActionPoints: 1,
        damageProfile: {
            dice: '1d8+3',
            type: 'energia',
            average: 7,
            notes: 'Rajada instável; explode ao chegar a 0 HP.',
        },
        tags: ['elemental', 'instavel'],
    },
    {
        id: 'guardiao-integridade',
        name: 'Guardião de Integridade',
        stats: { str: 16, dex: 14, con: 16, int: 12, wis: 13, cha: 12 },
        hitPoints: 68,
        armorClass: 16,
        actionPoints: 1,
        bonusActionPoints: 1,
        damageProfile: {
            dice: '1d10+4',
            type: 'radiância',
            average: 9,
            notes: 'Lâmina rúnica que causa dano adicional em criaturas corrompidas.',
        },
        tags: ['elite', 'biblioteca-arcana'],
    },
];
