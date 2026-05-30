import test from 'node:test';
import assert from 'node:assert/strict';

test('routeWsToUser entrega localmente no processo API', async () => {
    const prev = process.env.RUN_NARRATION_WORKER;
    delete process.env.RUN_NARRATION_WORKER;

    const registry = await import('../websocket/wsConnectionRegistry.js');
    const relay = await import('../websocket/wsUserRelay.js');

    const sent: string[] = [];
    const fakeWs = {
        readyState: 1,
        OPEN: 1,
        send: (raw: string) => sent.push(raw),
        userId: 99,
    } as never;

    registry.registerWsConnection(fakeWs);
    relay.routeWsToUser(99, { type: 'gameStateUpdate', payload: { ok: true } });

    assert.equal(sent.length, 1);
    assert.match(sent[0], /gameStateUpdate/);

    registry.unregisterWsConnection(fakeWs);
    if (prev === undefined) delete process.env.RUN_NARRATION_WORKER;
    else process.env.RUN_NARRATION_WORKER = prev;
});

test('isDedicatedNarrationWorkerProcess detecta RUN_NARRATION_WORKER', async () => {
    const { isDedicatedNarrationWorkerProcess } = await import('../websocket/wsUserRelay.js');
    const prev = process.env.RUN_NARRATION_WORKER;
    process.env.RUN_NARRATION_WORKER = 'true';
    assert.equal(isDedicatedNarrationWorkerProcess(), true);
    delete process.env.RUN_NARRATION_WORKER;
    assert.equal(isDedicatedNarrationWorkerProcess(), false);
    if (prev === undefined) delete process.env.RUN_NARRATION_WORKER;
    else process.env.RUN_NARRATION_WORKER = prev;
});
