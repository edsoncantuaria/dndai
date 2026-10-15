import createError from 'http-errors';

export const ATTRIBUTE_KEYS = [
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
] as const;

export type BaseAttributes = Record<(typeof ATTRIBUTE_KEYS)[number], number>;

const POINT_BUY_COST: Record<number, number> = {
    8: 0,
    9: 1,
    10: 2,
    11: 3,
    12: 4,
    13: 5,
    14: 7,
    15: 9,
};

const POINT_BUY_BUDGET = 27;

export type AttributeRollBreakdown = {
    attribute: (typeof ATTRIBUTE_KEYS)[number];
    dice: [number, number, number, number];
    kept: [number, number, number];
    total: number;
};

/** 4d6 descartando o menor — autoritativo no servidor. */
export function rollAttribute4d6(): { total: number; dice: [number, number, number, number]; kept: [number, number, number] } {
    const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1) as [number, number, number, number];
    const sorted = [...dice].sort((a, b) => a - b);
    const kept = sorted.slice(1) as [number, number, number];
    const total = kept.reduce((sum, value) => sum + value, 0);
    return { total, dice, kept };
}

export function rollFullAttributeSet(): { baseAttributes: BaseAttributes; rolls: AttributeRollBreakdown[] } {
    const rolls: AttributeRollBreakdown[] = [];
    const baseAttributes = {} as BaseAttributes;

    for (const attribute of ATTRIBUTE_KEYS) {
        const result = rollAttribute4d6();
        baseAttributes[attribute] = result.total;
        rolls.push({
            attribute,
            dice: result.dice,
            kept: result.kept,
            total: result.total,
        });
    }

    return { baseAttributes, rolls };
}

export function getPointBuyTotal(attrs: BaseAttributes): number {
    return ATTRIBUTE_KEYS.reduce((sum, key) => sum + (POINT_BUY_COST[attrs[key]] ?? 99), 0);
}

export function validatePointBuyBase(attrs: BaseAttributes): void {
    for (const key of ATTRIBUTE_KEYS) {
        const score = attrs[key];
        if (!Number.isInteger(score) || score < 8 || score > 15) {
            throw createError(400, `Atributo ${key} inválido para compra de pontos (${score}). Use valores entre 8 e 15.`);
        }
    }
    const spent = getPointBuyTotal(attrs);
    if (spent !== POINT_BUY_BUDGET) {
        throw createError(400, `Distribuição de pontos inválida: ${spent}/${POINT_BUY_BUDGET} pontos gastos.`);
    }
}

export function validateRolledBase(attrs: BaseAttributes): void {
    for (const key of ATTRIBUTE_KEYS) {
        const score = attrs[key];
        if (!Number.isInteger(score) || score < 3 || score > 18) {
            throw createError(400, `Atributo ${key} inválido para rolagem (${score}). Use valores entre 3 e 18.`);
        }
    }
    if (ATTRIBUTE_KEYS.every((key) => attrs[key] === 8)) {
        throw createError(400, 'Rolagem de atributos ainda não foi realizada.');
    }
}

export function attributesEqual(a: BaseAttributes, b: BaseAttributes): boolean {
    return ATTRIBUTE_KEYS.every((key) => a[key] === b[key]);
}

/** Garante que atributos finais = base + bônus raciais plausíveis (nível 1). */
export function validateFinalMatchesBase(final: BaseAttributes, base: BaseAttributes): void {
    for (const key of ATTRIBUTE_KEYS) {
        const delta = final[key] - base[key];
        if (delta < 0 || delta > 3) {
            throw createError(400, `Bônus racial inconsistente em ${key} (base ${base[key]}, final ${final[key]}).`);
        }
    }
}

export function validateFinalAttributesSanity(final: BaseAttributes): void {
    for (const key of ATTRIBUTE_KEYS) {
        const score = final[key];
        if (!Number.isInteger(score) || score < 3 || score > 20) {
            throw createError(400, `Atributo final ${key} fora do intervalo permitido (${score}).`);
        }
    }
}
