// backend/src/scripts/importSrdResources.ts
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { In, Not } from 'typeorm';
import { AppDataSource } from '../database/data-source.js';
import { SrdResource } from '../entities/SrdResource.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const normalizedDirs = [
    path.join(repoRoot, 'data', 'srd', '2014', 'normalized'),
    path.join(repoRoot, 'data', 'dnd5eapi', 'normalized'),
];
const metadataPaths = [
    path.join(repoRoot, 'data', 'srd', '2014', 'metadata.json'),
    path.join(repoRoot, 'data', 'dnd5eapi', 'metadata.json'),
];

async function resolveNormalizedDir() {
    for (const dir of normalizedDirs) {
        try {
            await fs.access(dir);
            return dir;
        } catch {
            // try next
        }
    }
    return normalizedDirs[normalizedDirs.length - 1];
}

async function resolveMetadataPath() {
    for (const filePath of metadataPaths) {
        try {
            await fs.access(filePath);
            return filePath;
        } catch {
            // try next
        }
    }
    return metadataPaths[metadataPaths.length - 1];
}

async function readJson(filePath: string) {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
}

type ResourceName = string;

async function importResource(normalizedDir: string, resource: ResourceName, syncedAt: string) {
    const filePath = path.join(normalizedDir, `${resource}.json`);
    try {
        const raw = await readJson(filePath);
        if (!Array.isArray(raw) || raw.length === 0) {
            console.warn(`[srd-import] ${resource}: no entries found, skipping.`);
            return;
        }
        const repo = AppDataSource.getRepository(SrdResource);
        const payloads = raw.map(entry => ({
            resource,
            index: entry.index,
            name: entry.name ?? entry.title ?? entry.full_name ?? null,
            payload: entry,
            syncedAt: new Date(syncedAt),
        }));

        await repo.upsert(payloads, ['resource', 'index']);

        const indexes = raw.map((entry: any) => entry.index);
        if (indexes.length) {
            await repo.delete({
                resource,
                index: Not(In(indexes)),
            });
        }

        console.log(`[srd-import] ${resource}: ${payloads.length} registros atualizados.`);
    } catch (error) {
        console.error(`[srd-import] Failed to import ${resource}:`, error);
    }
}

async function main() {
    const normalizedDir = await resolveNormalizedDir();
    const metadataPath = await resolveMetadataPath();
    const metadata = (await readJson(metadataPath)) as { resources: ResourceName[]; syncedAt?: string };
    const resources = metadata.resources || [];
    const syncedAt = metadata.syncedAt || new Date().toISOString();

    if (!resources.length) {
        console.error('[srd-import] No resources listed in metadata. Run sync-srd-api first.');
        process.exit(1);
    }

    console.log(`[srd-import] Using snapshots from ${normalizedDir}`);

    await AppDataSource.initialize();
    try {
        for (const resource of resources) {
            await importResource(normalizedDir, resource, syncedAt);
        }
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
    console.log('[srd-import] Import finished.');
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
