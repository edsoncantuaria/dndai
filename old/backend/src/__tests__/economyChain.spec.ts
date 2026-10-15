import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));

test('economyChain liga SUPPLY_SHORTAGE a rumor e fato', () => {
    const src = readFileSync(join(dir, '../GameMaster/world/economyChain.ts'), 'utf8');
    assert.match(src, /RUMOR_SPREAD/);
    assert.match(src, /recordProvenanceFact/);
    assert.match(src, /REGION_MOOD_CHANGED/);
});
