import fs from 'fs';
import path from 'path';
import { resolveSnapshotDir } from '../utils/srdSnapshotPaths.js';

type ResourceName =
    | 'races'
    | 'subraces'
    | 'classes'
    | 'subclasses'
    | 'backgrounds'
    | 'equipment'
    | 'equipment-categories'
    | 'spells'
    | 'traits'
    | 'feats'
    | 'monsters'
    | 'conditions'
    | 'rules'
    | 'rule-sections'
    | 'skills';

const fileCache = new Map<ResourceName, unknown[]>();

function resolveNormalizedDir(): string {
    return (
        resolveSnapshotDir() ??
        path.join(process.cwd(), 'srd-data', 'srd', '2014', 'normalized')
    );
}

function loadFromFile(resource: ResourceName): unknown[] {
    if (fileCache.has(resource)) return fileCache.get(resource)!;
    const filePath = path.join(resolveNormalizedDir(), `${resource}.json`);
    if (!fs.existsSync(filePath)) {
        console.warn(`[srd-catalog] Local snapshot missing for ${resource}`);
        fileCache.set(resource, []);
        return [];
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown[];
    fileCache.set(resource, data);
    return data;
}

export async function listSrdResources(resource: ResourceName): Promise<unknown[]> {
    return loadFromFile(resource);
}

export async function getSrdResource(resource: ResourceName, index: string): Promise<unknown | null> {
    const rows = await listSrdResources(resource);
    const hit = rows.find(
        row => row && typeof row === 'object' && (row as { index?: string }).index === index,
    );
    return hit ?? null;
}
