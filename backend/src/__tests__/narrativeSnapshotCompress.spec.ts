import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync, gzipSync } from 'zlib';

/** Espelha encode/decode de narrativeSnapshotService (P5.5). */
const PREFIX = 'gz1:';

function encode(payload: object): string {
    const json = JSON.stringify(payload);
    if (Buffer.byteLength(json, 'utf8') < 2048) return json;
    return PREFIX + gzipSync(Buffer.from(json, 'utf8')).toString('base64');
}

function decode(raw: string): object {
    if (raw.startsWith(PREFIX)) {
        const json = gunzipSync(Buffer.from(raw.slice(PREFIX.length), 'base64')).toString('utf8');
        return JSON.parse(json);
    }
    return JSON.parse(raw);
}

describe('narrativeSnapshot compress (P5.5)', () => {
    it('comprime payloads grandes e round-trip', () => {
        const payload = {
            staticMemoryBlock: 'x'.repeat(3000),
            stateVersion: 1,
            turnCounter: 2,
            builtAt: new Date().toISOString(),
        };
        const encoded = encode(payload);
        assert.ok(encoded.startsWith(PREFIX));
        const decoded = decode(encoded) as typeof payload;
        assert.equal(decoded.stateVersion, 1);
        assert.equal(decoded.staticMemoryBlock.length, 3000);
    });
});
