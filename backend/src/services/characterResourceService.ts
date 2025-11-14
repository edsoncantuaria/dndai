import { AppDataSource } from '../database/data-source.js';
import { Character } from '../entities/Character.js';
import { CharacterResource } from '../entities/CharacterResource.js';
import { listSrdResources } from './srdCatalogService.js';

type RestType = 'short-rest' | 'long-rest';

interface ResourceBlueprint {
    type: string;
    resourceKey: string;
    max: number;
    metadata: Record<string, any>;
}

interface ClassLevel {
    level: number;
    spellcasting?: Record<string, number>;
    class_specific?: Record<string, number>;
}

interface ClassEntry {
    index: string;
    name: string;
    levels?: ClassLevel[];
}

interface SyncReport {
    characterId: number;
    characterName?: string;
    created: number;
    updated: number;
    removed: number;
    totalDefined: number;
    classIndex?: string;
    skippedReason?: string;
}

const AUTO_SOURCE = 'class-derived';

const CLASS_ALIAS: Record<string, string> = {
    barbaro: 'barbarian',
    bárbaro: 'barbarian',
    bardo: 'bard',
    clerigo: 'cleric',
    clérigo: 'cleric',
    druida: 'druid',
    guerreiro: 'fighter',
    ladino: 'rogue',
    monge: 'monk',
    paladino: 'paladin',
    patrulheiro: 'ranger',
    patrulheira: 'ranger',
    ranger: 'ranger',
    feiticeiro: 'sorcerer',
    mago: 'wizard',
    bruxo: 'warlock',
    bruxa: 'warlock',
};

const FEATURE_MAP: Record<
    string,
    { key: string; label: string; refresh: RestType; min?: number }
> = {
    action_surges: { key: 'action-surge', label: 'Action Surge', refresh: 'short-rest' },
    indomitable_uses: { key: 'indomitable', label: 'Indomável', refresh: 'long-rest' },
    rage_count: { key: 'rage', label: 'Fúria', refresh: 'long-rest' },
    ki_points: { key: 'ki', label: 'Pontos de Ki', refresh: 'short-rest' },
    sorcery_points: { key: 'sorcery-points', label: 'Pontos de Feitiçaria', refresh: 'long-rest' },
    channel_divinity_charges: { key: 'channel-divinity', label: 'Canalizar Divindade', refresh: 'short-rest' },
};

const MYSTIC_ARCANUM_FIELDS: { field: string; level: number }[] = [
    { field: 'mystic_arcanum_level_6', level: 6 },
    { field: 'mystic_arcanum_level_7', level: 7 },
    { field: 'mystic_arcanum_level_8', level: 8 },
    { field: 'mystic_arcanum_level_9', level: 9 },
];

let cachedClasses: ClassEntry[] | null = null;
let aliasMap: Map<string, ClassEntry> | null = null;

const normalize = (value?: string) =>
    (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

async function loadClasses(): Promise<ClassEntry[]> {
    if (cachedClasses) return cachedClasses;
    const rows = (await listSrdResources('classes')) as ClassEntry[];
    cachedClasses = rows ?? [];
    aliasMap = new Map();

    for (const entry of cachedClasses) {
        const tokens = new Set<string>([
            entry.index,
            entry.name,
            entry.name.replace(/\s+/g, '-'),
        ]);

        tokens.add(entry.index.replace(/\s+/g, ''));
        tokens.add(entry.name.replace(/\s+/g, ''));

        for (const token of tokens) {
            aliasMap.set(normalize(token), entry);
        }
    }

    for (const [alias, classIndex] of Object.entries(CLASS_ALIAS)) {
        const normalized = normalize(alias);
        const target = cachedClasses.find(cls => cls.index === classIndex);
        if (target) {
            aliasMap.set(normalized, target);
        }
    }

    return cachedClasses;
}

async function resolveClassEntry(characterClass: string): Promise<ClassEntry | undefined> {
    if (!characterClass) return undefined;
    const classes = await loadClasses();
    if (!aliasMap) {
        aliasMap = new Map();
        for (const entry of classes) {
            aliasMap.set(normalize(entry.index), entry);
            aliasMap.set(normalize(entry.name), entry);
        }
    }
    const normalized = normalize(characterClass);
    return aliasMap.get(normalized);
}

function buildSpellSlotBlueprints(classEntry: ClassEntry, levelData: ClassLevel): ResourceBlueprint[] {
    if (!levelData.spellcasting) {
        return [];
    }

    const refresh: RestType = classEntry.index === 'warlock' ? 'short-rest' : 'long-rest';
    const result: ResourceBlueprint[] = [];

    for (let slotLevel = 1; slotLevel <= 9; slotLevel += 1) {
        const key = `spell_slots_level_${slotLevel}`;
        const slots = levelData.spellcasting[key];
        if (typeof slots === 'number' && slots > 0) {
            result.push({
                type: 'spell-slot',
                resourceKey: `level-${slotLevel}`,
                max: slots,
                metadata: {
                    source: AUTO_SOURCE,
                    classIndex: classEntry.index,
                    className: classEntry.name,
                    slotLevel,
                    refresh,
                    label: `Slots de Magia Nível ${slotLevel}`,
                },
            });
        }
    }

    return result;
}

function buildClassFeatureBlueprints(classEntry: ClassEntry, levelData: ClassLevel): ResourceBlueprint[] {
    const specific = levelData.class_specific;
    if (!specific) return [];

    const blueprints: ResourceBlueprint[] = [];

    for (const [field, config] of Object.entries(FEATURE_MAP)) {
        const value = specific[field];
        if (typeof value === 'number' && value > 0) {
            blueprints.push({
                type: 'class-feature',
                resourceKey: config.key,
                max: value,
                metadata: {
                    source: AUTO_SOURCE,
                    classIndex: classEntry.index,
                    className: classEntry.name,
                    label: config.label,
                    refresh: config.refresh,
                },
            });
        }
    }

    for (const { field, level } of MYSTIC_ARCANUM_FIELDS) {
        const value = specific[field];
        if (typeof value === 'number' && value > 0) {
            blueprints.push({
                type: 'class-feature',
                resourceKey: `mystic-arcanum-${level}`,
                max: value,
                metadata: {
                    source: AUTO_SOURCE,
                    classIndex: classEntry.index,
                    className: classEntry.name,
                    label: `Místico Arcanum (nível ${level})`,
                    refresh: 'long-rest',
                },
            });
        }
    }

    return blueprints;
}

function ensureCharacterLoaded(characterOrId: number | Character, withResources = true): Promise<Character | null> {
    const repo = AppDataSource.getRepository(Character);
    if (typeof characterOrId === 'number') {
        return repo.findOne({
            where: { id: characterOrId },
            relations: withResources ? ['resources'] : undefined,
        });
    }
    if (withResources && !characterOrId.resources) {
        return repo.findOne({
            where: { id: characterOrId.id },
            relations: ['resources'],
        });
    }
    return Promise.resolve(characterOrId);
}

const makeKey = (type: string, resourceKey: string) => `${type}:${resourceKey}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const metadataChanged = (current: Record<string, any> | null | undefined, next: Record<string, any>) => {
    const a = JSON.stringify(current ?? {});
    const b = JSON.stringify(next);
    return a !== b;
};

function pickLevelData(classEntry: ClassEntry, level: number): ClassLevel | undefined {
    const available = classEntry.levels || [];
    if (!available.length) return undefined;
    return available.find(l => l.level === level) ?? available[available.length - 1];
}

export async function syncCharacterResources(characterOrId: number | Character): Promise<SyncReport> {
    const character = await ensureCharacterLoaded(characterOrId);
    if (!character) {
        throw new Error('Personagem não encontrado para sincronizar recursos.');
    }

    const classEntry = await resolveClassEntry(character.characterClass);
    if (!classEntry) {
        return {
            characterId: character.id,
            characterName: character.name,
            created: 0,
            updated: 0,
            removed: 0,
            totalDefined: 0,
            skippedReason: 'class-not-found',
        };
    }

    const levelData = pickLevelData(classEntry, character.level);
    if (!levelData) {
        return {
            characterId: character.id,
            characterName: character.name,
            created: 0,
            updated: 0,
            removed: 0,
            totalDefined: 0,
            classIndex: classEntry.index,
            skippedReason: 'level-missing',
        };
    }

    const desired = [
        ...buildSpellSlotBlueprints(classEntry, levelData),
        ...buildClassFeatureBlueprints(classEntry, levelData),
    ];

    const resourceRepo = AppDataSource.getRepository(CharacterResource);
    const resources = character.resources ?? (await resourceRepo.find({ where: { characterId: character.id } }));

    const managedResources = resources.filter(res => (res.metadata as any)?.source === AUTO_SOURCE);
    const existingMap = new Map(managedResources.map(res => [makeKey(res.type, res.resourceKey), res]));
    const desiredKeys = new Set(desired.map(res => makeKey(res.type, res.resourceKey)));

    let created = 0;
    let updated = 0;

    for (const blueprint of desired) {
        const mapKey = makeKey(blueprint.type, blueprint.resourceKey);
        const existing = existingMap.get(mapKey);
        if (existing) {
            let dirty = false;
            if (existing.max !== blueprint.max) {
                existing.max = blueprint.max;
                if (typeof existing.current !== 'number' || existing.current > blueprint.max) {
                    existing.current = blueprint.max;
                }
                dirty = true;
            }
            if (metadataChanged(existing.metadata, blueprint.metadata)) {
                existing.metadata = blueprint.metadata;
                dirty = true;
            }
            if (dirty) {
                await resourceRepo.save(existing);
                updated += 1;
            }
        } else {
            const entity = resourceRepo.create({
                characterId: character.id,
                type: blueprint.type,
                resourceKey: blueprint.resourceKey,
                current: blueprint.max,
                max: blueprint.max,
                metadata: blueprint.metadata,
            });
            await resourceRepo.save(entity);
            created += 1;
        }
    }

    const toRemove = managedResources.filter(res => !desiredKeys.has(makeKey(res.type, res.resourceKey)));
    let removed = 0;
    if (toRemove.length) {
        await resourceRepo.remove(toRemove);
        removed = toRemove.length;
    }

    return {
        characterId: character.id,
        characterName: character.name,
        created,
        updated,
        removed,
        totalDefined: desired.length,
        classIndex: classEntry.index,
    };
}

export async function syncResourcesForAllCharacters(): Promise<SyncReport[]> {
    const repo = AppDataSource.getRepository(Character);
    const characters = await repo.find({ relations: ['resources'] });
    const reports: SyncReport[] = [];
    for (const character of characters) {
        const report = await syncCharacterResources(character);
        reports.push(report);
    }
    return reports;
}

export interface CharacterResourceChange {
    type: string;
    resourceKey: string;
    delta: number;
    metadata?: Record<string, any>;
}

export interface ResourceChangeResult {
    resource: CharacterResource;
    deltaApplied: number;
}

export async function applyResourceChanges(
    characterId: number,
    changes: CharacterResourceChange[]
): Promise<ResourceChangeResult[]> {
    if (!changes.length) return [];
    const repo = AppDataSource.getRepository(CharacterResource);
    const existing = await repo.find({ where: { characterId } });
    const map = new Map(existing.map(res => [makeKey(res.type, res.resourceKey), res]));
    const results: ResourceChangeResult[] = [];

    for (const change of changes) {
        if (change.delta === 0) continue;
        const key = makeKey(change.type, change.resourceKey);
        let resource = map.get(key);

        if (!resource) {
            resource = repo.create({
                characterId,
                type: change.type,
                resourceKey: change.resourceKey,
                current: 0,
                max: Math.max(change.delta, 0),
                metadata: change.metadata ?? null,
            });
            map.set(key, resource);
        }

        const previous = resource.current ?? 0;
        const maxValue =
            typeof resource.max === 'number' && resource.max > 0 ? resource.max : Math.max(previous, 0, previous + change.delta);
        const nextValue = clamp(previous + change.delta, 0, maxValue || previous + change.delta);
        const appliedDelta = nextValue - previous;

        if (change.metadata) {
            resource.metadata = {
                ...(resource.metadata ?? {}),
                ...change.metadata,
            };
        }

        if (appliedDelta !== 0) {
            resource.current = nextValue;
            await repo.save(resource);
        }

        results.push({ resource, deltaApplied: appliedDelta });
    }

    return results;
}
