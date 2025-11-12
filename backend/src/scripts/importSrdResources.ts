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
const normalizedDir = path.join(repoRoot, 'data', 'dnd5eapi', 'normalized');
const metadataPath = path.join(repoRoot, 'data', 'dnd5eapi', 'metadata.json');

async function readJson(filePath: string) {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
}

type ResourceName = string;

async function importResource(resource: ResourceName, syncedAt: string) {
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
    const metadata = (await readJson(metadataPath)) as { resources: ResourceName[]; syncedAt?: string };
    const resources = metadata.resources || [];
    const syncedAt = metadata.syncedAt || new Date().toISOString();

    if (!resources.length) {
        console.error('[srd-import] No resources listed in metadata. Run sync-dnd5eapi first.');
        process.exit(1);
    }

    await AppDataSource.initialize();
    try {
        for (const resource of resources) {
            await importResource(resource, syncedAt);
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
