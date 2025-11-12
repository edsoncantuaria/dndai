// backend/src/rules/classes.ts
import { getSrdResource, listSrdResources } from '../services/srdCatalogService.js';

export interface ClassLevelProgression {
    level: number;
    proficiencyBonus: number;
    features: string[];
    spellSlots: Record<number, number>;
    cantripsKnown?: number | null;
    spellsKnown?: number | null;
}

export interface NormalizedClass {
    index: string;
    name: string;
    hitDie: number;
    primaryAbility: string[];
    savingThrows: string[];
    spellcastingAbility?: string | null;
    levels: ClassLevelProgression[];
}

function normalizeSpellSlots(spellcasting: any): Record<number, number> {
    const slots: Record<number, number> = {};
    if (!spellcasting) return slots;
    for (let level = 1; level <= 9; level++) {
        const key = `spell_slots_level_${level}`;
        if (typeof spellcasting[key] === 'number') {
            slots[level] = spellcasting[key];
        }
    }
    return slots;
}

function normalizeClassLevel(levelEntry: any): ClassLevelProgression {
    const features = (levelEntry.features ?? []).map((feature: any) => feature.name);
    const spellSlots = normalizeSpellSlots(levelEntry.spellcasting);
    return {
        level: levelEntry.level,
        proficiencyBonus: levelEntry.prof_bonus ?? 0,
        features,
        spellSlots,
        cantripsKnown: levelEntry.spellcasting?.cantrips_known ?? null,
        spellsKnown: levelEntry.spellcasting?.spells_known ?? null,
    };
}

export async function getNormalizedClass(index: string): Promise<NormalizedClass | null> {
    const classData = await getSrdResource('classes', index);
    if (!classData) return null;
    const levels = Array.isArray(classData.levels)
        ? classData.levels.map(normalizeClassLevel)
        : [];
    return {
        index: classData.index,
        name: classData.name,
        hitDie: Number(classData.hit_die) || 0,
        primaryAbility: classData.multi_classing?.prerequisites
            ?.map((pre: any) => pre.ability_score?.index)
            ?.filter(Boolean) ?? [],
        savingThrows: (classData.saving_throws ?? []).map((save: any) => save.index),
        spellcastingAbility: classData.spellcasting?.spellcasting_ability?.index ?? null,
        levels,
    };
}

export async function listNormalizedClasses(): Promise<NormalizedClass[]> {
    const classes = await listSrdResources('classes');
    const normalized: NormalizedClass[] = [];
    for (const classEntry of classes) {
        const entry = await getNormalizedClass(classEntry.index);
        if (entry) normalized.push(entry);
    }
    return normalized;
}
