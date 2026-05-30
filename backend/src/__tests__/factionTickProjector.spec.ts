import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, '../GameMaster/world/simulation/ticks/factionTick.ts'), 'utf8');

test('factionTick não muta reputação antes do evento (só projector)', () => {
    assert.doesNotMatch(src, /reputationScore\s*\+=/);
    assert.doesNotMatch(src, /stateRepo\.save\(row\)/);
    assert.match(src, /FACTION_TICK/);
});
