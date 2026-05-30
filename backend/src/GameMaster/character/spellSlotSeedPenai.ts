import type { CharacterResourceSnapshot } from '../../rules/types.js';
import { listSrdResources } from '../../services/srdCatalogService.js';

type ClassLevel = { level: number; spellcasting?: Record<string, number> };

type ClassEntry = { index: string; name: string; levels?: ClassLevel[] };

const CLASS_ALIAS: Record<string, string> = {
    mago: 'wizard',
    wizard: 'wizard',
    feiticeiro: 'sorcerer',
    sorcerer: 'sorcerer',
    clérigo: 'cleric',
    clerigo: 'cleric',
    cleric: 'cleric',
    druida: 'druid',
    druid: 'druid',
    bruxo: 'warlock',
    warlock: 'warlock',
    bardo: 'bard',
    bard: 'bard',
    paladino: 'paladin',
    paladin: 'paladin',
    ranger: 'ranger',
    patrulheiro: 'ranger',
};

function normalize(value: string): string {
    return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function resolveClassEntry(characterClass: string): Promise<ClassEntry | undefined> {
    const classes = (await listSrdResources('classes')) as ClassEntry[];
    const key = CLASS_ALIAS[normalize(characterClass)] ?? normalize(characterClass);
    return classes.find(c => normalize(c.index) === key || normalize(c.name) === key);
}

/** Seed spell slots SRD para recursos da sessão PENAI (sem MySQL). */
export async function buildPenaiSpellSlotResources(
    characterClass: string,
    level: number,
): Promise<CharacterResourceSnapshot[]> {
    const classEntry = await resolveClassEntry(characterClass);
    if (!classEntry?.levels?.length) return [];

    const levelData =
        classEntry.levels.find(l => l.level === level) ??
        classEntry.levels[classEntry.levels.length - 1];
    if (!levelData?.spellcasting) return [];

    const refresh = classEntry.index === 'warlock' ? 'short-rest' : 'long-rest';
    const resources: CharacterResourceSnapshot[] = [];

    for (let slotLevel = 1; slotLevel <= 9; slotLevel += 1) {
        const slots = levelData.spellcasting[`spell_slots_level_${slotLevel}`];
        if (typeof slots === 'number' && slots > 0) {
            resources.push({
                type: 'spell-slot',
                key: `level-${slotLevel}`,
                current: slots,
                max: slots,
                refresh,
            });
        }
    }
    return resources;
}

export async function mergeSpellSlotsIntoResources(
    existing: CharacterResourceSnapshot[],
    characterClass: string,
    level: number,
): Promise<CharacterResourceSnapshot[]> {
    const slots = await buildPenaiSpellSlotResources(characterClass, level);
    if (!slots.length) return existing;
    const withoutSlots = existing.filter(r => r.type !== 'spell-slot');
    return [...withoutSlots, ...slots];
}
