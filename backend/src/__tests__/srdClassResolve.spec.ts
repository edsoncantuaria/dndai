import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
    loadSrdClassLevels,
    resolveSrdClassIndex,
} from '../services/srdClassResolve.js';
import { resolveSnapshotDir } from '../utils/srdSnapshotPaths.js';

test('resolveSrdClassIndex mapeia ladino para rogue', () => {
    assert.equal(resolveSrdClassIndex('Ladino'), 'rogue');
    assert.equal(resolveSrdClassIndex('rogue'), 'rogue');
    assert.equal(resolveSrdClassIndex('  Mago '), 'wizard');
});

test('loadSrdClassLevels retorna níveis do snapshot quando presente', async () => {
    const dir = resolveSnapshotDir();
    if (!dir || !fs.existsSync(path.join(dir, 'classes.json'))) {
        console.warn('[srdClassResolve] Sem snapshot de classes — teste ignorado.');
        return;
    }
    const levels = await loadSrdClassLevels('rogue');
    assert.ok(Array.isArray(levels));
    assert.ok(levels.length >= 20);
    assert.equal((levels[0] as { level?: number }).level, 1);
});
