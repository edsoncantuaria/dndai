/**
 * P4.7 — smoke de invariantes do pipeline distribuído (sem Redis/MySQL).
 */
import assert from 'node:assert/strict';
import { shouldCancelNarrationJob } from '../queue/narrationQueueCancel.js';
import { isStaleNarrationSequence, setCachedActionSequence } from '../services/actionSequenceService.js';
import { shouldEmitNarrationStream, NARRATION_STREAM_CANONICAL } from '../ai-oss/core/streamPolicy.js';
import { applySnapshotToMemoryLayers } from '../services/narrativeSnapshotService.js';
import { isNarrationQueuedResponse, buildQueuedNarrationAck } from '../queue/narrationDispatch.js';

const steps: Array<{ name: string; run: () => void | Promise<void> }> = [
    {
        name: 'stale sequence',
        run: async () => {
            setCachedActionSequence(7, 4);
            assert.equal(await isStaleNarrationSequence(7, 3), true);
            assert.equal(await isStaleNarrationSequence(7, 4), false);
        },
    },
    {
        name: 'cancel waiting jobs',
        run: () => {
            assert.equal(shouldCancelNarrationJob({ sessionId: 1, actionSequence: 2 }, 1, 5), true);
            assert.equal(shouldCancelNarrationJob({ sessionId: 1, actionSequence: 5 }, 1, 5), false);
        },
    },
    {
        name: 'stream not canonical',
        run: () => {
            assert.equal(NARRATION_STREAM_CANONICAL, false);
            assert.equal(shouldEmitNarrationStream({ streamEnabled: true, actionId: 'a', asyncQueueActive: true }), false);
            assert.equal(shouldEmitNarrationStream({ streamEnabled: true, actionId: 'a' }), true);
        },
    },
    {
        name: 'snapshot merge',
        run: () => {
            const merged = applySnapshotToMemoryLayers(
                { staticMemoryBlock: 'Resumo=foo', stateVersion: 1, turnCounter: 1, builtAt: '' },
                ['Recall=bar'],
            );
            assert.match(merged ?? '', /Resumo=foo/);
            assert.match(merged ?? '', /Recall=bar/);
        },
    },
    {
        name: 'queued ack marker',
        run: () => {
            assert.equal(isNarrationQueuedResponse(buildQueuedNarrationAck()), true);
        },
    },
];

for (const step of steps) {
    await step.run();
    console.log(`[chaosPipelineSmoke] OK — ${step.name}`);
}
console.log(`[chaosPipelineSmoke] ${steps.length} checks passed`);
