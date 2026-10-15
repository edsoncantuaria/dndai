import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURSOR_HOME = path.join(os.homedir(), '.cursor', 'image-bridge');

/** Pasta onde as imagens prontas são salvas (uso global no Cursor, não por projeto). */
export const OUTPUT_DIR =
  process.env.IMAGE_BRIDGE_OUTPUT_DIR || path.join(CURSOR_HOME, 'output');

export const DATA_DIR = process.env.IMAGE_BRIDGE_DATA_DIR || path.join(CURSOR_HOME, 'data');
export const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image';
}

export async function ensureDirs() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function loadJobs() {
  try {
    const raw = await fs.readFile(JOBS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { jobs: {} };
  }
}

export async function saveJobs(store) {
  await fs.writeFile(JOBS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Bridge-Secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

export function checkSecret(req, secret) {
  if (!secret) return true;
  const header = req.headers['x-bridge-secret'];
  return header === secret;
}
