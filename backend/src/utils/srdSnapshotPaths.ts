import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd(), '..');

/** Diretórios de snapshot offline, do mais recente ao legado. */
export const SRD_SNAPSHOT_DIRS = [
    path.join(repoRoot, 'data', 'srd', '2014', 'normalized'),
    path.join(repoRoot, 'data', 'dnd5eapi', 'normalized'),
] as const;

export const SRD_METADATA_PATHS = [
    path.join(repoRoot, 'data', 'srd', '2014', 'metadata.json'),
    path.join(repoRoot, 'data', 'dnd5eapi', 'metadata.json'),
] as const;

export function resolveSnapshotDir(): string | null {
    for (const dir of SRD_SNAPSHOT_DIRS) {
        if (fs.existsSync(dir)) return dir;
    }
    return null;
}

export function resolveMetadataPath(): string | null {
    for (const filePath of SRD_METADATA_PATHS) {
        if (fs.existsSync(filePath)) return filePath;
    }
    return null;
}

/** Extrai o nome do arquivo JSON a partir do recurso raiz (ex: classes/fighter → classes). */
export function snapshotFileForResource(resource: string): string {
    const root = resource.split('/')[0]?.trim().toLowerCase();
    return `${root}.json`;
}
