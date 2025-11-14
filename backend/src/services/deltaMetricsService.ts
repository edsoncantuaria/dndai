const counters = {
    damage: 0,
    healing: 0,
    spellSlotsUsed: 0,
    rests: {
        short: 0,
        long: 0,
    },
};

export const recordDamage = (amount?: number) => {
    if (!amount || amount <= 0) return;
    counters.damage += amount;
};

export const recordHealing = (amount?: number) => {
    if (!amount || amount <= 0) return;
    counters.healing += amount;
};

export const recordSpellSlotUse = (amount?: number) => {
    if (!amount || amount <= 0) return;
    counters.spellSlotsUsed += amount;
};

export const recordRestMetric = (restType?: 'short' | 'long') => {
    if (!restType) return;
    counters.rests[restType] += 1;
};

export const formatDeltaMetrics = () => {
    return [
        `dndai_damage_total ${counters.damage}`,
        `dndai_healing_total ${counters.healing}`,
        `dndai_spell_slots_used_total ${counters.spellSlotsUsed}`,
        `dndai_rests_total{type="short"} ${counters.rests.short}`,
        `dndai_rests_total{type="long"} ${counters.rests.long}`,
    ].join('\n');
};
