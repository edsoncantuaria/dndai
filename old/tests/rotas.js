// scripts/testUnifiedApiHealth.js
import fetch from 'node-fetch';

const BASE_URL = process.env.TEST_API_BASE_URL || 'https://backend-5e.edsin-server.space/api/data';

const ENDPOINTS = [
  'ability-scores',
  'alignments',
  'backgrounds',
  'classes',
  'conditions',
  'damage-types',
  'equipment',
  'equipment-categories',
  'feats',
  'languages',
  'magic-schools',
  'monsters',
  'proficiencies',
  'races',
  'skills',
  'spells',
  'subclasses',
  'subraces',
  'traits',
  'features',
  'rules',
  'rule-sections',
];

const TIMEOUT = 10000; // 10s por request

async function testEndpoint(endpoint) {
  const url = `${BASE_URL}/${endpoint}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const duration = Date.now() - start;

    if (!res.ok) {
      console.error(`❌ [${res.status}] ${endpoint} (${duration}ms)`);
      return { endpoint, status: res.status, duration, ok: false };
    }

    const data = await res.json();

    if (!data || (!Array.isArray(data.results) && !Array.isArray(data))) {
      console.warn(`⚠️ [${res.status}] ${endpoint} retornou formato inesperado (${duration}ms)`);
      return { endpoint, status: res.status, duration, ok: true, warning: true };
    }

    const count = Array.isArray(data.results) ? data.results.length : data.length;
    console.log(`✅ ${endpoint} - ${count} itens (${duration}ms)`);
    return { endpoint, status: res.status, duration, ok: true };
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`💀 ${endpoint} falhou (${duration}ms): ${err.message}`);
    return { endpoint, ok: false, error: err.message, duration };
  }
}

async function runTests() {
  console.log('🧭 Iniciando verificação de integridade das rotas D&D API unificadas...');
  console.log(`Backend: ${BASE_URL}`);
  console.log('---');

  const results = [];
  for (const endpoint of ENDPOINTS) {
    const result = await testEndpoint(endpoint);
    results.push(result);
  }

  console.log('---');
  const ok = results.filter(r => r.ok && !r.warning).length;
  const warnings = results.filter(r => r.warning).length;
  const fails = results.filter(r => !r.ok).length;

  console.log(`✅ Sucesso: ${ok} | ⚠️ Avisos: ${warnings} | ❌ Falhas: ${fails}`);
  console.log('---');

  if (fails > 0) process.exitCode = 1;
}

runTests();
