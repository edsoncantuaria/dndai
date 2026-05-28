import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveInputGate } from '@/hooks/game/inputGate';

test('InputGate: roll pendente sempre bloqueia (LOCKED_ROLLING)', () => {
  assert.equal(
    deriveInputGate({
      phase: 'idle',
      hasPlayerRollRequest: true,
      hasPendingActions: false,
      isLoading: false,
    }),
    'LOCKED_ROLLING',
  );

  assert.equal(
    deriveInputGate({
      phase: 'rolling',
      hasPlayerRollRequest: false,
      hasPendingActions: false,
      isLoading: false,
    }),
    'LOCKED_ROLLING',
  );
});

test('InputGate: narrating bloqueia (LOCKED_NARRATING)', () => {
  assert.equal(
    deriveInputGate({
      phase: 'narrating',
      hasPlayerRollRequest: false,
      hasPendingActions: false,
      isLoading: false,
    }),
    'LOCKED_NARRATING',
  );
});

test('InputGate: idle sem loading e sem pendências é OPEN', () => {
  assert.equal(
    deriveInputGate({
      phase: 'idle',
      hasPlayerRollRequest: false,
      hasPendingActions: false,
      isLoading: false,
    }),
    'OPEN',
  );
});

