import fs from 'fs';
import path from 'path';

function candidateSnapshotDirs(): string[] {
    const cwd = process.cwd();
    const parent = path.resolve(cwd, '..');
    return [
        process.env.SRD_SNAPSHOT_DIR,
        path.join(cwd, 'srd-data', 'srd', '2014', 'normalized'),
        path.join(cwd, 'data', 'srd', '2014', 'normalized'),
        path.join(parent, 'data', 'srd', '2014', 'normalized'),
        path.join(parent, 'data', 'dnd5eapi', 'normalized'),
    ].filter((dir): dir is string => Boolean(dir?.trim()));
}

function candidateMetadataPaths(): string[] {
    const cwd = process.cwd();
    const parent = path.resolve(cwd, '..');
    return [
        process.env.SRD_METADATA_PATH,
        path.join(cwd, 'srd-data', 'srd', '2014', 'metadata.json'),
        path.join(cwd, 'data', 'srd', '2014', 'metadata.json'),
        path.join(parent, 'data', 'srd', '2014', 'metadata.json'),
        path.join(parent, 'data', 'dnd5eapi', 'metadata.json'),
    ].filter((filePath): filePath is string => Boolean(filePath?.trim()));
}

/** Diretórios de snapshot offline, do mais específico (Docker) ao legado (repo). */
export function listSnapshotDirCandidates(): string[] {
    return candidateSnapshotDirs();
}

export const SRD_SNAPSHOT_DIRS = listSnapshotDirCandidates();

export const SRD_METADATA_PATHS = candidateMetadataPaths();

export function resolveSnapshotDir(): string | null {
    for (const dir of candidateSnapshotDirs()) {
        if (fs.existsSync(dir)) return dir;
    }
    return null;
}

/** Snapshot SRD offline obrigatório (seed PT-BR, adapter offline). */
export function requireSnapshotDir(): string {
    const dir = resolveSnapshotDir();
    if (!dir) {
        throw new Error(
            'Snapshot SRD ausente — monte data/srd/2014/normalized (Docker: ./data → /app/srd-data) ou defina SRD_SNAPSHOT_DIR',
        );
    }
    return dir;
}

export function resolveMetadataPath(): string | null {
    for (const filePath of candidateMetadataPaths()) {
        if (fs.existsSync(filePath)) return filePath;
    }
    return null;
}

/** Extrai o nome do arquivo JSON a partir do recurso raiz (ex: classes/fighter → classes). */
export function snapshotFileForResource(resource: string): string {
    const root = resource.split('/')[0]?.trim().toLowerCase();
    return `${root}.json`;
}
