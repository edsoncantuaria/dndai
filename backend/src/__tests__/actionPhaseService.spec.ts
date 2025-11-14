import test from 'node:test';
import assert from 'node:assert/strict';
import { AppDataSource } from '../database/data-source.js';
import {
    beginActionPhase,
    advanceActionPhase,
    clearActionPhase,
} from '../services/actionPhaseService.js';

type SessionRecord = {
    id: number;
    userId: number;
    currentActionId: string | null;
    currentActionPhase: string | null;
    actionPhaseUpdatedAt: Date | null;
};

const originalGetRepository = AppDataSource.getRepository.bind(AppDataSource);

const mockRepository = (session: SessionRecord) => {
    return {
        findOne: async ({ where }: { where: { id: number; userId: number } }) => {
            if (where.id === session.id && where.userId === session.userId) {
                return { ...session };
            }
            return null;
        },
        update: async (
            criteria: { id: number; userId?: number; currentActionId?: string | null },
            partial: Partial<SessionRecord>,
        ) => {
            if (criteria.id !== session.id) return;
            if (typeof criteria.userId === 'number' && criteria.userId !== session.userId) return;
            if (
                Object.prototype.hasOwnProperty.call(criteria, 'currentActionId') &&
                criteria.currentActionId !== session.currentActionId
            ) {
                return;
            }
            Object.assign(session, partial);
        },
    };
};

const useSessionMock = (session: SessionRecord, t: test.TestContext) => {
    AppDataSource.getRepository = () => mockRepository(session);
    t.after(() => {
        AppDataSource.getRepository = originalGetRepository;
    });
    return session;
};

test('action phase progresses sequentially and rejects skips', async t => {
    const session = useSessionMock(
        {
            id: 1,
            userId: 99,
            currentActionId: null,
            currentActionPhase: null,
            actionPhaseUpdatedAt: null,
        },
        t,
    );

    await beginActionPhase({ sessionId: 1, userId: 99, actionId: 'A-1' });
    assert.equal(session.currentActionId, 'A-1');
    assert.equal(session.currentActionPhase, 'RECEIVED');

    await advanceActionPhase({ sessionId: 1, userId: 99, actionId: 'A-1', phase: 'NORMALIZED' });
    assert.equal(session.currentActionPhase, 'NORMALIZED');

    await advanceActionPhase({ sessionId: 1, userId: 99, actionId: 'A-1', phase: 'RULES' });
    assert.equal(session.currentActionPhase, 'RULES');

    await assert.rejects(
        () => advanceActionPhase({ sessionId: 1, userId: 99, actionId: 'A-1', phase: 'DELTA_APPLIED' }),
        /ACTION_PHASE_OUT_OF_ORDER/,
    );

    await advanceActionPhase({ sessionId: 1, userId: 99, actionId: 'A-1', phase: 'AI_SYNTHESIS' });
    await advanceActionPhase({ sessionId: 1, userId: 99, actionId: 'A-1', phase: 'DELTA_APPLIED' });
    assert.equal(session.currentActionPhase, 'DELTA_APPLIED');
});

test('beginActionPhase blocks concurrent actions but releases after clear', async t => {
    const session = useSessionMock(
        {
            id: 2,
            userId: 77,
            currentActionId: null,
            currentActionPhase: null,
            actionPhaseUpdatedAt: null,
        },
        t,
    );

    await beginActionPhase({ sessionId: 2, userId: 77, actionId: 'A-keep' });
    await assert.rejects(
        () => beginActionPhase({ sessionId: 2, userId: 77, actionId: 'A-rival' }),
        /ACTION_PHASE_IN_PROGRESS/,
    );

    await clearActionPhase({ sessionId: 2, actionId: 'A-keep' });
    assert.equal(session.currentActionId, null);
    assert.equal(session.currentActionPhase, null);

    await beginActionPhase({ sessionId: 2, userId: 77, actionId: 'A-new' });
    assert.equal(session.currentActionId, 'A-new');
});

test('stale phases allow new actions to take ownership', async t => {
    const session = useSessionMock(
        {
            id: 3,
            userId: 55,
            currentActionId: 'old-action',
            currentActionPhase: 'AI_SYNTHESIS',
            actionPhaseUpdatedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago (stale)
        },
        t,
    );

    await beginActionPhase({ sessionId: 3, userId: 55, actionId: 'new-action' });
    assert.equal(session.currentActionId, 'new-action');
    assert.equal(session.currentActionPhase, 'RECEIVED');
});
