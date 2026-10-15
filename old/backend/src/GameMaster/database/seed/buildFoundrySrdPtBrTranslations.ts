/**
 * Converte compendiums Foundry SRD PT em rows de tradução para o bundle srd-ptbr-core.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { requireSnapshotDir } from '../../../utils/srdSnapshotPaths.js';
import {
    htmlToDescArray,
    loadFoundryCompendium,
    normFeatureKey,
    slugify,
    type FoundryCompendium,
    type FoundryCompendiumEntry,
} from './foundrySrdPtBrClient.js';

export type FoundryTranslationRow = {
    type: 'spell' | 'item' | 'monster' | 'feature' | 'class';
    name: string;
    content: Record<string, unknown>;
    sourceIndex: string;
    sourceResource: string;
    /** Chave EN do compendium Foundry (ex.: "Fireball"). */
    englishKey?: string;
};

function loadJson<T>(fileName: string): T {
    return JSON.parse(readFileSync(join(requireSnapshotDir(), fileName), 'utf-8')) as T;
}

function isHashKey(key: string): boolean {
    return /^[a-z0-9]{10,}$/i.test(key);
}

function entryPtName(entry: FoundryCompendiumEntry, fallbackKey: string): string {
    return String(entry.name ?? entry.label ?? fallbackKey).trim();
}

function buildSpellRows(spellsComp: FoundryCompendium): FoundryTranslationRow[] {
    const srdSpells = loadJson<Array<{ index: string; name: string }>>('spells.json');
    const byName = new Map(srdSpells.map(s => [s.name.toLowerCase(), s.index]));
    const rows: FoundryTranslationRow[] = [];

    for (const [key, entry] of Object.entries(spellsComp.entries ?? {})) {
        const sourceIndex = byName.get(key.toLowerCase()) ?? slugify(key);
        if (!srdSpells.some(s => s.index === sourceIndex)) continue;
        const desc = entry.description ? htmlToDescArray(entry.description) : [];
        if (desc.length === 0 && !entry.name) continue;

        rows.push({
            type: 'spell',
            name: entryPtName(entry, key),
            englishKey: key,
            content: {
                name: entryPtName(entry, key),
                ...(desc.length > 0 ? { desc } : {}),
                index: sourceIndex,
                official_index: sourceIndex,
            },
            sourceIndex,
            sourceResource: 'spells',
        });
    }
    return rows;
}

function buildItemRows(itemsComp: FoundryCompendium): FoundryTranslationRow[] {
    const srdItems = loadJson<Array<{ index: string; name: string }>>('equipment.json');
    const byIndex = new Set(srdItems.map(i => i.index));
    const byName = new Map(srdItems.map(i => [i.name.toLowerCase(), i.index]));
    const rows: FoundryTranslationRow[] = [];

    for (const [key, entry] of Object.entries(itemsComp.entries ?? {})) {
        const sourceIndex = byName.get(key.toLowerCase()) ?? slugify(key);
        if (!byIndex.has(sourceIndex)) continue;
        const desc = entry.description ? htmlToDescArray(entry.description) : [];
        if (desc.length === 0 && !entry.name) continue;

        rows.push({
            type: 'item',
            name: entryPtName(entry, key),
            englishKey: key,
            content: {
                name: entryPtName(entry, key),
                ...(desc.length > 0 ? { desc } : {}),
                index: sourceIndex,
                official_index: sourceIndex,
            },
            sourceIndex,
            sourceResource: 'equipment',
        });
    }
    return rows;
}

function buildMonsterRows(monstersComp: FoundryCompendium): FoundryTranslationRow[] {
    const srdMonsters = loadJson<Array<{ index: string; name: string }>>('monsters.json');
    const byIndex = new Set(srdMonsters.map(m => m.index));
    const rows: FoundryTranslationRow[] = [];

    for (const [key, entry] of Object.entries(monstersComp.entries ?? {})) {
        const sourceIndex = slugify(key);
        if (!byIndex.has(sourceIndex)) continue;
        const ptName = entryPtName(entry, key);
        if (!ptName) continue;

        rows.push({
            type: 'monster',
            name: ptName,
            content: {
                name: ptName,
                index: sourceIndex,
                official_index: sourceIndex,
            },
            sourceIndex,
            sourceResource: 'monsters',
        });
    }
    return rows;
}

function buildFeatureRows(featuresComp: FoundryCompendium): FoundryTranslationRow[] {
    const srdFeatures = loadJson<Array<{ index: string; name: string }>>('features.json');
    const byNormKey = new Map<string, string[]>();
    for (const feature of srdFeatures) {
        const key = normFeatureKey(feature.name);
        const list = byNormKey.get(key) ?? [];
        list.push(feature.index);
        byNormKey.set(key, list);
    }

    const rows: FoundryTranslationRow[] = [];
    const seen = new Set<string>();

    for (const [key, entry] of Object.entries(featuresComp.entries ?? {})) {
        if (isHashKey(key)) continue;
        const indices = byNormKey.get(normFeatureKey(key));
        if (!indices?.length) continue;

        const desc = entry.description ? htmlToDescArray(entry.description) : [];
        const ptName = entryPtName(entry, key);
        if (desc.length === 0 && !ptName) continue;

        for (const sourceIndex of indices) {
            const dedupe = `${sourceIndex}:${ptName}`;
            if (seen.has(dedupe)) continue;
            seen.add(dedupe);

            rows.push({
                type: 'feature',
                name: ptName,
                content: {
                    name: ptName,
                    ...(desc.length > 0 ? { desc } : {}),
                    index: sourceIndex,
                    official_index: sourceIndex,
                },
                sourceIndex,
                sourceResource: 'features',
            });
        }
    }
    return rows;
}

function buildClassRows(classesComp: FoundryCompendium): FoundryTranslationRow[] {
    const srdClasses = loadJson<Array<{ index: string; name: string }>>('classes.json');
    const byName = new Map(srdClasses.map(c => [c.name.toLowerCase(), c.index]));
    const rows: FoundryTranslationRow[] = [];

    for (const [key, entry] of Object.entries(classesComp.entries ?? {})) {
        const sourceIndex = byName.get(key.toLowerCase()) ?? slugify(key);
        if (!srdClasses.some(c => c.index === sourceIndex)) continue;
        const desc = entry.description ? htmlToDescArray(entry.description) : [];
        const ptName = entryPtName(entry, key);
        if (desc.length === 0 && !ptName) continue;

        rows.push({
            type: 'class',
            name: ptName,
            content: {
                name: ptName,
                ...(desc.length > 0 ? { desc } : {}),
                index: sourceIndex,
                official_index: sourceIndex,
            },
            sourceIndex,
            sourceResource: 'classes',
        });
    }
    return rows;
}

export async function buildFoundrySrdPtBrTranslations(options?: {
    skipFetch?: boolean;
}): Promise<FoundryTranslationRow[]> {
    const [spells, items, monsters, classFeatures, classes] = await Promise.all([
        loadFoundryCompendium('dnd5e.spells.json', options),
        loadFoundryCompendium('dnd5e.items.json', options),
        loadFoundryCompendium('dnd5e.monsters.json', options),
        loadFoundryCompendium('dnd5e.classfeatures.json', options),
        loadFoundryCompendium('dnd5e.classes.json', options),
    ]);

    return [
        ...buildSpellRows(spells),
        ...buildItemRows(items),
        ...buildMonsterRows(monsters),
        ...buildFeatureRows(classFeatures),
        ...buildClassRows(classes),
    ];
}

export function mergeTranslationContent(
    base: Record<string, unknown>,
    overlay: Record<string, unknown>,
): Record<string, unknown> {
    const merged = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
        if (value !== undefined && value !== null) {
            merged[key] = value;
        }
    }
    return merged;
}
