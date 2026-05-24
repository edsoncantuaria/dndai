// backend/src/services/srdCatalogService.ts
import fs from 'fs';
import path from 'path';
import { AppDataSource } from '../database/data-source.js';
import { SrdResource } from '../entities/SrdResource.js';
import { resolveSnapshotDir } from '../utils/srdSnapshotPaths.js';

type ResourceName =
    | 'races'
    | 'subraces'
    | 'classes'
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

const repoRoot = path.resolve(process.cwd(), '..');
const normalizedDir = resolveSnapshotDir() ?? path.join(repoRoot, 'data', 'dnd5eapi', 'normalized');
const fileCache = new Map<ResourceName, any[]>();

function loadFromFile(resource: ResourceName) {
    if (fileCache.has(resource)) return fileCache.get(resource)!;
    const filePath = path.join(normalizedDir, `${resource}.json`);
    if (!fs.existsSync(filePath)) {
        console.warn(`[srd-catalog] Local snapshot missing for ${resource}`);
        fileCache.set(resource, []);
        return [];
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    fileCache.set(resource, data);
    return data;
}

export async function listSrdResources(resource: ResourceName): Promise<any[]> {
    if (AppDataSource.isInitialized) {
        const repo = AppDataSource.getRepository(SrdResource);
        const rows = await repo.find({ where: { resource } });
        if (rows.length) {
            return rows.map(row => row.payload);
        }
    }
    return loadFromFile(resource);
}

export async function getSrdResource(resource: ResourceName, index: string): Promise<any | null> {
    if (AppDataSource.isInitialized) {
        const repo = AppDataSource.getRepository(SrdResource);
        const row = await repo.findOne({ where: { resource, index } });
        if (row) return row.payload;
    }
    const fallback = loadFromFile(resource);
    return fallback.find(entry => entry.index === index) ?? null;
}
