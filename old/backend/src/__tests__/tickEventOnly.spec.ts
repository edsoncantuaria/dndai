import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');

test('ticks de região/economia não persistem antes do projector', () => {
    const region = readFileSync(
        join(root, 'GameMaster/world/simulation/ticks/regionStateTick.ts'),
        'utf8',
    );
    const economy = readFileSync(
        join(root, 'GameMaster/world/simulation/ticks/economyTick.ts'),
        'utf8',
    );
    assert.doesNotMatch(region, /SessionRegionState\)\.save/);
    assert.doesNotMatch(economy, /applyScarcityToPrice/);
    assert.match(region, /REGION_MOOD_CHANGED/);
    assert.match(economy, /PRICE_CHANGED/);
});
