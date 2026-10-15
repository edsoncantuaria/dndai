#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const https = require('https');

const API_BASE = 'https://www.dnd5eapi.co';
const OUTPUT_DIR = path.join(process.cwd(), 'data', 'dnd5eapi');
const RAW_DIR = path.join(OUTPUT_DIR, 'raw');
const NORMALIZED_DIR = path.join(OUTPUT_DIR, 'normalized');

const resources = [
  'races',
  'subraces',
  'classes',
  'backgrounds',
  'equipment',
  'equipment-categories',
  'skills',
  'ability-scores',
  'proficiencies',
  'spells',
  'traits',
  'feats',
  'monsters',
  'conditions',
  'rules',
  'rule-sections'
];

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 200;

async function ensureDirs() {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(NORMALIZED_DIR, { recursive: true });
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function fetchJson(endpoint, redirectCount = 0, attempt = 0) {
  const url = `${API_BASE}${endpoint}`;
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectCount > 5) {
            reject(new Error(`Too many redirects for ${url}`));
            return;
          }
          const location = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${API_BASE}${res.headers.location}`;
          resolve(fetchJson(location.replace(API_BASE, ''), redirectCount + 1));
          return;
        }
        if (res.statusCode === 429) {
          if (attempt >= MAX_RETRIES) {
            reject(new Error(`GET ${url} failed: 429 (max retries reached)`));
            res.resume();
            return;
          }
          const retryAfterHeader = res.headers['retry-after'];
          const retryDelay =
            retryAfterHeader != null
              ? parseInt(retryAfterHeader, 10) * 1000
              : BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[sync] 429 for ${url}. Retrying in ${retryDelay}ms`);
          res.resume();
          setTimeout(() => {
            resolve(fetchJson(endpoint, redirectCount, attempt + 1));
          }, retryDelay);
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
  const data = await fetchJson(`/api/${resource}`);
  return Array.isArray(data?.results) ? data.results : [];
}

async function fetchResource(resource, index) {
  const base = await fetchJson(`/api/${resource}/${index}`);
  if (resource === 'classes') {
    try {
      const levels = await fetchJson(`/api/classes/${index}/levels`);
      base.levels = levels;
    } catch (error) {
      console.warn(`[sync] Failed to fetch class levels for ${index}:`, error.message ?? error);
    }
  }
  return base;
}

function normalizeEntry(resource, entry) {
  // Placeholder for richer normalization
  return { ...entry, _resource: resource };
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
  await fs.writeFile(path.join(RAW_DIR, `${resource}.json`), JSON.stringify(raw, null, 2));
  await fs.writeFile(path.join(NORMALIZED_DIR, `${resource}.json`), JSON.stringify(normalized, null, 2));
}

async function main() {
  console.log('Syncing dnd5eapi resources...');
  await ensureDirs();
  for (const resource of resources) {
    await syncResource(resource);
  }
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'metadata.json'),
    JSON.stringify({ syncedAt: new Date().toISOString(), resources }, null, 2)
  );
  console.log('Sync complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
