/** Regras SRD 5e — death saving throws e estados de vitalidade do herói. */

export type DeathSaveState = {
    successes: number;
    failures: number;
};

export type HeroVitalStatus = 'alive' | 'unconscious' | 'stable' | 'dead';

export type HeroVitals = {
    hp: number;
    maxHp: number;
    heroStatus: HeroVitalStatus;
    deathSaves: DeathSaveState;
    conditions: string[];
};

export const DEATH_SAVE_DC = 10;
export const DEATH_SAVE_MAX = 3;

export function defaultDeathSaves(): DeathSaveState {
    return { successes: 0, failures: 0 };
}

export function isPermanentlyDead(deathSaves: DeathSaveState): boolean {
    return deathSaves.failures >= DEATH_SAVE_MAX;
}

export function isStable(deathSaves: DeathSaveState): boolean {
    return deathSaves.successes >= DEATH_SAVE_MAX;
}

export function addCondition(conditions: string[], condition: string): string[] {
    const c = condition.trim().toLowerCase();
    if (!c || conditions.includes(c)) return conditions;
    return [...conditions, c];
}

export function removeCondition(conditions: string[], condition: string): string[] {
    const c = condition.trim().toLowerCase();
    return conditions.filter(x => x !== c);
}

/** HP caiu a 0 — inconsciente, death saves zerados. */
export function enterUnconscious(vitals: HeroVitals): HeroVitals {
    if (vitals.heroStatus === 'dead') return vitals;
    return {
        ...vitals,
        hp: 0,
        heroStatus: 'unconscious',
        deathSaves: defaultDeathSaves(),
        conditions: addCondition(vitals.conditions, 'unconscious'),
    };
}

/** Dano recebido enquanto a 0 HP (SRD: 1 falha; crítico = 2 falhas). */
export function applyDamageWhileUnconscious(
    vitals: HeroVitals,
    opts: { isCritical?: boolean; damage?: number },
): HeroVitals {
    if (vitals.heroStatus === 'dead') return vitals;
    if (vitals.hp > 0) return vitals;

    const failuresToAdd = opts.isCritical ? 2 : 1;
    const deathSaves = {
        successes: vitals.deathSaves.successes,
        failures: Math.min(DEATH_SAVE_MAX, vitals.deathSaves.failures + failuresToAdd),
    };

    if (isPermanentlyDead(deathSaves)) {
        return markDead({ ...vitals, deathSaves });
    }

    return {
        ...vitals,
        hp: 0,
        heroStatus: 'unconscious',
        deathSaves,
        conditions: addCondition(vitals.conditions, 'unconscious'),
    };
}

export type DeathSaveRollOutcome =
    | { kind: 'dead' }
    | { kind: 'stable'; vitals: HeroVitals }
    | { kind: 'unconscious'; vitals: HeroVitals }
    | { kind: 'revived'; vitals: HeroVitals; hp: number };

/** Resolve um death save (d20 bruto + mod CON já aplicado em rollTotal). */
export function resolveDeathSaveRoll(
    vitals: HeroVitals,
    rollTotal: number,
    rawD20: number,
): DeathSaveRollOutcome {
    if (vitals.heroStatus === 'dead') return { kind: 'dead' };

    if (rawD20 === 20) {
        const revived = wakeFromHealing({ ...vitals, hp: 1 });
        return { kind: 'revived', vitals: revived, hp: 1 };
    }

    let deathSaves = { ...vitals.deathSaves };

    if (rawD20 === 1) {
        deathSaves.failures = Math.min(DEATH_SAVE_MAX, deathSaves.failures + 2);
    } else if (rollTotal >= DEATH_SAVE_DC) {
        deathSaves.successes = Math.min(DEATH_SAVE_MAX, deathSaves.successes + 1);
    } else {
        deathSaves.failures = Math.min(DEATH_SAVE_MAX, deathSaves.failures + 1);
    }

    if (isPermanentlyDead(deathSaves)) {
        return { kind: 'dead' };
    }

    if (isStable(deathSaves)) {
        const stable: HeroVitals = {
            ...vitals,
            hp: 0,
            heroStatus: 'stable',
            deathSaves,
            conditions: removeCondition(vitals.conditions, 'unconscious'),
        };
        return { kind: 'stable', vitals: stable };
    }

    const unconscious: HeroVitals = {
        ...vitals,
        hp: 0,
        heroStatus: 'unconscious',
        deathSaves,
        conditions: addCondition(vitals.conditions, 'unconscious'),
    };
    return { kind: 'unconscious', vitals: unconscious };
}

/** Cura positiva — acorda e limpa death saves. */
export function wakeFromHealing(vitals: HeroVitals): HeroVitals {
    if (vitals.heroStatus === 'dead') return vitals;
    const hp = Math.max(1, vitals.hp);
    return {
        ...vitals,
        hp: Math.min(hp, vitals.maxHp),
        heroStatus: 'alive',
        deathSaves: defaultDeathSaves(),
        conditions: removeCondition(vitals.conditions, 'unconscious'),
    };
}

export function markDead(vitals: HeroVitals): HeroVitals {
    return {
        ...vitals,
        hp: 0,
        heroStatus: 'dead',
        deathSaves: {
            successes: vitals.deathSaves.successes,
            failures: DEATH_SAVE_MAX,
        },
        conditions: removeCondition(vitals.conditions, 'unconscious'),
    };
}

/** Sincroniza status após mudança de HP. */
export function syncVitalsAfterHpChange(
    vitals: HeroVitals,
    prevHp: number,
    opts?: { damageWhileDown?: boolean; isCritical?: boolean },
): HeroVitals {
    if (vitals.heroStatus === 'dead') return vitals;

    if (vitals.hp > 0) {
        if (prevHp <= 0 || vitals.heroStatus !== 'alive') {
            return wakeFromHealing(vitals);
        }
        return {
            ...vitals,
            heroStatus: 'alive',
            deathSaves: defaultDeathSaves(),
            conditions: removeCondition(vitals.conditions, 'unconscious'),
        };
    }

    if (prevHp > 0 && vitals.hp === 0) {
        return enterUnconscious(vitals);
    }

    if (vitals.hp === 0 && opts?.damageWhileDown) {
        return applyDamageWhileUnconscious(vitals, { isCritical: opts.isCritical });
    }

    return vitals;
}

export function needsDeathSaveRoll(vitals: HeroVitals): boolean {
    return (
        vitals.hp === 0 &&
        vitals.heroStatus === 'unconscious' &&
        !isStable(vitals.deathSaves) &&
        !isPermanentlyDead(vitals.deathSaves)
    );
}

export function heroCanTakeActions(vitals: HeroVitals): boolean {
    if (vitals.heroStatus === 'dead') return false;
    if (vitals.hp <= 0 && vitals.heroStatus !== 'alive') return false;
    return true;
}
