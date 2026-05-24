// src/rules/catalog.ts
import fs from 'fs';
import path from 'path';

type Resource =
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
  | 'rule-sections';

export interface CatalogMetadata {
  syncedAt?: string;
  resources: Resource[];
}

const SNAPSHOT_DIRS = [
  path.join(process.cwd(), 'data', 'srd', '2014', 'normalized'),
  path.join(process.cwd(), 'data', 'dnd5eapi', 'normalized'),
];

function resolveBaseDir(): string {
  for (const dir of SNAPSHOT_DIRS) {
    if (fs.existsSync(dir)) return dir;
  }
  return SNAPSHOT_DIRS[SNAPSHOT_DIRS.length - 1];
}

const BASE_DIR = resolveBaseDir();

const cache = new Map<Resource, any[]>();

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function loadResource(resource: Resource) {
  if (cache.has(resource)) {
    return cache.get(resource)!;
  }
  const filePath = path.join(BASE_DIR, `${resource}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`[catalog] Missing snapshot for ${resource}. Did you run sync-srd-api?`);
    cache.set(resource, []);
    return [];
  }
  const data = readJson(filePath);
  cache.set(resource, data);
  return data;
}

export function getCatalogMetadata(): CatalogMetadata {
  const metaPath = path.join(path.dirname(BASE_DIR), 'metadata.json');
  if (!fs.existsSync(metaPath)) {
    return { resources: [] };
  }
  return readJson(metaPath);
}

export function getResourceList<T = any>(resource: Resource): T[] {
  return loadResource(resource) as T[];
}

export function getResourceByIndex<T = any>(resource: Resource, index: string): T | undefined {
  const list = loadResource(resource);
  return list.find((item: any) => item.index === index);
}

export function clearCatalogCache() {
  cache.clear();
}
