#!/usr/bin/env node
/**
 * Sincroniza snapshots SRD 2014 a partir da 5e-srd-api local (ou remota).
 *
 * Uso:
 *   docker compose -f docker-compose.srd.yml up -d --build
 *   node scripts/sync-srd-api.js
 *
 * Env:
 *   SRD_API_BASE=http://localhost:3000/api/2014
 */
const fs = require('fs/promises');
const path = require('path');
const http = require('http');
const https = require('https');

const API_BASE = (process.env.SRD_API_BASE || 'http://localhost:3000/api/2014').replace(/\/$/, '');
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'srd', '2014');
const RAW_DIR = path.join(OUTPUT_DIR, 'raw');
const NORMALIZED_DIR = path.join(OUTPUT_DIR, 'normalized');
const LEGACY_DIR = path.join(process.cwd(), 'data', 'dnd5eapi', 'normalized');

const resources = [
  'ability-scores',
  'alignments',
  'backgrounds',
  'classes',
  'conditions',
  'damage-types',
  'equipment',
  'equipment-categories',
  'feats',
  'features',
  'languages',
  'magic-schools',
  'monsters',
  'proficiencies',
  'races',
  'rule-sections',
  'rules',
  'skills',
  'spells',
  'subclasses',
  'subraces',
  'traits',
  'weapon-properties',
];

const nestedClassEndpoints = ['levels', 'spells', 'features', 'starting-equipment', 'subclasses'];
const nestedSubclassEndpoints = ['levels', 'features'];

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 150;

async function ensureDirs() {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(NORMALIZED_DIR, { recursive: true });
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function fetchJson(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client
      .get(url, { headers: { Accept: 'application/json' } }, res => {
        if (res.statusCode === 429) {
          if (attempt >= MAX_RETRIES) {
            reject(new Error(`GET ${url} failed: 429`));
            res.resume();
            return;
          }
          const retryAfter = Number(res.headers['retry-after'] || 1) * 1000;
          res.resume();
          setTimeout(() => resolve(fetchJson(url, attempt + 1)), retryAfter);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`GET ${url} failed: ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

async function listResource(resource) {
  const data = await fetchJson(`${API_BASE}/${resource}`);
  return Array.isArray(data?.results) ? data.results : [];
}

async function fetchResource(resource, index) {
  const base = await fetchJson(`${API_BASE}/${resource}/${index}`);

  if (resource === 'classes') {
    for (const nested of nestedClassEndpoints) {
      try {
        const payload = await fetchJson(`${API_BASE}/${resource}/${index}/${nested}`);
        if (nested === 'starting-equipment') base.starting_equipment = payload;
        else base[nested] = payload;
      } catch (error) {
        console.warn(`[sync-srd] ${resource}/${index}/${nested}:`, error.message);
      }
    }
  }

  if (resource === 'subclasses') {
    for (const nested of nestedSubclassEndpoints) {
      try {
        base[nested] = await fetchJson(`${API_BASE}/${resource}/${index}/${nested}`);
      } catch (error) {
        console.warn(`[sync-srd] ${resource}/${index}/${nested}:`, error.message);
      }
    }
  }

  return base;
}

function normalizeEntry(resource, entry) {
  return { ...entry, _resource: resource, _source: '5e-srd-api', _version: '2014' };
}

async function syncResource(resource) {
  console.log(`→ ${resource}`);
  const list = await listResource(resource);
  const raw = [];
  const normalized = [];

  for (const item of list) {
    await delay(BASE_DELAY_MS);
    const entry = await fetchResource(resource, item.index);
    raw.push(entry);
    normalized.push(normalizeEntry(resource, entry));
  }

  const rawPath = path.join(RAW_DIR, `${resource}.json`);
  const normalizedPath = path.join(NORMALIZED_DIR, `${resource}.json`);
  await fs.writeFile(rawPath, JSON.stringify(raw, null, 2));
  await fs.writeFile(normalizedPath, JSON.stringify(normalized, null, 2));

  // Mantém compatibilidade com caminho legado usado pelo motor
  await fs.mkdir(LEGACY_DIR, { recursive: true });
  await fs.writeFile(path.join(LEGACY_DIR, `${resource}.json`), JSON.stringify(normalized, null, 2));
}

async function main() {
  console.log(`[sync-srd] Base: ${API_BASE}`);
  await ensureDirs();

  try {
    const root = await fetchJson(`${API_BASE}`);
    console.log(`[sync-srd] API OK — ${Object.keys(root || {}).length} coleções`);
  } catch (error) {
    console.error('[sync-srd] API inacessível. Suba o stack: docker compose -f docker-compose.srd.yml up -d --build');
    throw error;
  }

  for (const resource of resources) {
    await syncResource(resource);
  }

  const metadata = {
    syncedAt: new Date().toISOString(),
    apiBase: API_BASE,
    version: '2014',
    resources,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2));
  await fs.writeFile(
    path.join(process.cwd(), 'data', 'dnd5eapi', 'metadata.json'),
    JSON.stringify({ ...metadata, legacyMirror: true }, null, 2),
  );

  console.log('[sync-srd] Sync completo → data/srd/2014/ (+ espelho legado em data/dnd5eapi/normalized)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
