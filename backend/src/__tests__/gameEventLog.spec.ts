import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMechanicalNarrativeSplitEnabled } from '../config/mechanicalNarrativeSplit.js';
import { GAME_EVENT_PREFIX } from '../events/types.js';
import { gameEventActionType } from '../events/types.js';

describe('gameEventLog', () => {
    it('split mecânico × narrativo está sempre ativo', () => {
        assert.equal(isMechanicalNarrativeSplitEnabled(), true);
    });

    it('prefixo de eventos append-only', () => {
        assert.equal(gameEventActionType('IntentReceived'), `${GAME_EVENT_PREFIX}IntentReceived`);
    });
});
