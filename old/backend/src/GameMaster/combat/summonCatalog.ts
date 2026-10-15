/** Templates mecânicos simplificados (SRD-adjacent) para invocações. */
export type SummonTemplate = {
    key: string;
    displayName: string;
    hpMax: number;
    ac: number;
    attackBonus: number;
    damageDice: string;
    canAttack: boolean;
};

export const SUMMON_TEMPLATES: Record<string, SummonTemplate> = {
    wolf: {
        key: 'wolf',
        displayName: 'Lobo',
        hpMax: 11,
        ac: 13,
        attackBonus: 4,
        damageDice: '2d4+2',
        canAttack: true,
    },
    skeleton: {
        key: 'skeleton',
        displayName: 'Esqueleto',
        hpMax: 13,
        ac: 13,
        attackBonus: 4,
        damageDice: '1d6+2',
        canAttack: true,
    },
    zombie: {
        key: 'zombie',
        displayName: 'Zumbi',
        hpMax: 22,
        ac: 8,
        attackBonus: 3,
        damageDice: '1d6+1',
        canAttack: true,
    },
    'familiar-cat': {
        key: 'familiar-cat',
        displayName: 'Familiar (gato)',
        hpMax: 2,
        ac: 12,
        attackBonus: 0,
        damageDice: '1',
        canAttack: false,
    },
    'ranger-companion': {
        key: 'ranger-companion',
        displayName: 'Companheiro animal',
        hpMax: 15,
        ac: 13,
        attackBonus: 4,
        damageDice: '1d6+2',
        canAttack: true,
    },
};

export type SummonSpellConfig = {
    slotLevel: number;
    templateKeys: string[];
    /** Quantidade base de criaturas invocadas (MVP simplificado). */
    count: number;
    expiresAfterCombat: boolean;
};

/** Magias de conjuração com criaturas rastreáveis no motor PenAI. */
export const SUMMON_SPELLS: Record<string, SummonSpellConfig> = {
    'animate-dead': {
        slotLevel: 3,
        templateKeys: ['skeleton'],
        count: 1,
        expiresAfterCombat: false,
    },
    'conjure-animals': {
        slotLevel: 3,
        templateKeys: ['wolf'],
        count: 1,
        expiresAfterCombat: true,
    },
    'find-familiar': {
        slotLevel: 1,
        templateKeys: ['familiar-cat'],
        count: 1,
        expiresAfterCombat: false,
    },
};

const CONJURATION_SCHOOL = 'conjuration';

export function isSummonSpellIndex(spellIndex: string): boolean {
    return Boolean(SUMMON_SPELLS[spellIndex.trim().toLowerCase()]);
}

export function inferSummonSpellFromText(text: string): string | null {
    const lower = text.toLowerCase();
    if (/\b(animate dead|animar mortos?|levantar mortos?|esqueletos?|zumbis?)\b/.test(lower)) {
        return 'animate-dead';
    }
    if (/\b(conjure animals|conjurar animais|invocar animais|lobos?|ursinhos?)\b/.test(lower)) {
        return 'conjure-animals';
    }
    if (/\b(find familiar|encontrar familiar|invocar familiar|familia)\b/.test(lower)) {
        return 'find-familiar';
    }
    return null;
}

export function spellSchoolIsConjuration(school: string | undefined): boolean {
    if (!school) return false;
    return school.toLowerCase().includes(CONJURATION_SCHOOL);
}
