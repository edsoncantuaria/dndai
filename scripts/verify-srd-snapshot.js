#!/usr/bin/env node
/**
 * Verifica que o snapshot SRD offline está presente (CI — Fase 7.5).
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const NORMALIZED = path.join(repoRoot, 'data', 'srd', '2014', 'normalized');
const REQUIRED = ['races.json', 'classes.json', 'spells.json', 'equipment.json'];

let failed = false;
if (!fs.existsSync(NORMALIZED)) {
    console.error(`[verify-srd] Diretório ausente: ${NORMALIZED}`);
    process.exit(1);
}

for (const file of REQUIRED) {
    const full = path.join(NORMALIZED, file);
    if (!fs.existsSync(full)) {
        console.error(`[verify-srd] Arquivo obrigatório ausente: ${file}`);
        failed = true;
        continue;
    }
    const stat = fs.statSync(full);
    if (stat.size < 100) {
        console.error(`[verify-srd] Arquivo vazio ou inválido: ${file}`);
        failed = true;
        continue;
    }
    console.log(`[verify-srd] OK ${file} (${Math.round(stat.size / 1024)} KB)`);
}

const metaPath = path.join(repoRoot, 'data', 'srd', '2014', 'metadata.json');
if (fs.existsSync(metaPath)) {
    console.log('[verify-srd] metadata.json presente');
} else {
    console.warn('[verify-srd] metadata.json ausente (opcional)');
}

process.exit(failed ? 1 : 0);
