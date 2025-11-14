import test from 'node:test';
import assert from 'node:assert/strict';

process.env.REDIS_URL = 'mock';

const loadService = async () => {
    const mod = await import('../services/rollRequestService.js');
    return mod;
};

const sampleRequest = (overrides?: Partial<any>) => ({
    reason: 'Teste',
    dice: '1d20',
    modifier: 2,
    rollType: 'check',
    advantage: false,
    disadvantage: false,
    details: [],
    metadata: { effect: 'check' },
    ...overrides,
});

test('roll queue blocks concurrent roll requests per sessão', async t => {
    const service = await loadService();
    const hooks = service.__rollRequestTestHooks;
    hooks.useMemoryOnly();
    t.after(() => hooks.reset());

    await service.savePendingRollRequest(1, 10, { ...sampleRequest(), requestId: 'roll-1' }, { actionId: 'action-1' });
    await assert.rejects(
        () =>
            service.savePendingRollRequest(1, 10, { ...sampleRequest(), requestId: 'roll-2' }, { actionId: 'action-2' }),
        /ROLL_IN_PROGRESS/
    );
    await service.clearPendingRollRequest(1);
    await service.savePendingRollRequest(1, 10, { ...sampleRequest(), requestId: 'roll-3' }, { actionId: 'action-3' });
    const pending = await service.getPendingRollRequest(1);
    assert.equal(pending?.requestId, 'roll-3');
});

test('replaying same rollId is idempotent', async t => {
    const service = await loadService();
    const hooks = service.__rollRequestTestHooks;
    hooks.useMemoryOnly();
    t.after(() => hooks.reset());

    await service.savePendingRollRequest(2, 10, { ...sampleRequest(), requestId: 'repeat-roll' }, { actionId: 'action-5' });
    await service.savePendingRollRequest(2, 10, { ...sampleRequest(), requestId: 'repeat-roll' }, { actionId: 'action-5' });
    const queueHead = await hooks.peekQueueHead(2);
    assert.equal(queueHead?.rollId, 'repeat-roll');
    await service.clearPendingRollRequest(2);
    const remaining = await service.getPendingRollRequest(2);
    assert.equal(remaining, null);
});
