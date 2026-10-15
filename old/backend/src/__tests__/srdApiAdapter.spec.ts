import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('srdApiAdapter lista raças do snapshot offline', async () => {
    process.env.SRD_OFFLINE_ONLY = 'true';

    const repoRoot = path.resolve(process.cwd(), '..');
    const snapshotDirs = [
        path.join(repoRoot, 'data', 'srd', '2014', 'normalized'),
        path.join(repoRoot, 'data', 'dnd5eapi', 'normalized'),
    ];
    const hasSnapshot = snapshotDirs.some(dir => fs.existsSync(path.join(dir, 'races.json')));
    if (!hasSnapshot) {
        console.warn('[srdApiAdapter.spec] Sem snapshot de races — teste ignorado.');
        return;
    }

    const { clearSnapshotCache, list } = await import('../services/srdApiAdapter.js');
    clearSnapshotCache();
    const races = await list('races');
    assert.ok(races);
    assert.ok(Array.isArray(races.results));
    assert.ok(races.results.length > 0);
    assert.ok(races.results[0].index);
});

test('srdApiAdapter obtém detalhe de raça offline', async () => {
    process.env.SRD_OFFLINE_ONLY = 'true';

    const repoRoot = path.resolve(process.cwd(), '..');
    const snapshotDirs = [
        path.join(repoRoot, 'data', 'srd', '2014', 'normalized'),
        path.join(repoRoot, 'data', 'dnd5eapi', 'normalized'),
    ];
    const racesFile = snapshotDirs
        .map(dir => path.join(dir, 'races.json'))
        .find(filePath => fs.existsSync(filePath));
    if (!racesFile) return;

    const rows = JSON.parse(fs.readFileSync(racesFile, 'utf-8'));
    const sampleIndex = rows[0]?.index;
    if (!sampleIndex) return;

    const { clearSnapshotCache, get } = await import('../services/srdApiAdapter.js');
    clearSnapshotCache();
    const detail = await get('races', sampleIndex);
    assert.ok(detail);
    assert.equal(detail.index, sampleIndex);
});

test('srdApiAdapter detalhe de classe mantém hit_die (não substitui por levels)', async () => {
    process.env.SRD_OFFLINE_ONLY = 'true';

    const repoRoot = path.resolve(process.cwd(), '..');
    const classesFile = [
        path.join(repoRoot, 'data', 'srd', '2014', 'normalized', 'classes.json'),
        path.join(repoRoot, 'data', 'dnd5eapi', 'normalized', 'classes.json'),
    ].find((filePath) => fs.existsSync(filePath));
    if (!classesFile) return;

    const { clearSnapshotCache, get } = await import('../services/srdApiAdapter.js');
    clearSnapshotCache();
    const fighter = await get('classes', 'fighter');
    assert.ok(fighter);
    assert.equal(typeof fighter.hit_die, 'number');
    assert.ok(Array.isArray(fighter.saving_throws));
    assert.ok(fighter.saving_throws.length > 0);

    const levels = await get('classes/fighter', 'levels');
    assert.ok(Array.isArray(levels));
    assert.ok(levels.length > 0);
});

test('resolveSnapshotDir encontra diretório legado ou novo', async () => {
    const { resolveSnapshotDir } = await import('../utils/srdSnapshotPaths.js');
    const dir = resolveSnapshotDir();
  if (!dir) {
        console.warn('[srdSnapshotPaths] Nenhum snapshot presente no repo.');
        return;
    }
    assert.ok(fs.existsSync(dir));
});
