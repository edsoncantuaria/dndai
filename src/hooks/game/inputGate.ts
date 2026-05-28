export type InputGate =
  | 'OPEN'
  | 'LOCKED_MECHANICAL'
  | 'LOCKED_ROLLING'
  | 'LOCKED_NARRATING';

export type InputGatePhase = 'idle' | 'rolling' | 'mechanical' | 'narrating';

export type InputGateSignals = {
  phase: InputGatePhase;
  hasPlayerRollRequest: boolean;
  hasPendingActions: boolean;
  isLoading: boolean;
};

/**
 * Deriva o gate a partir de sinais do UI/turn pipeline.
 *
 * Prioridade:
 * - rolling (roll pendente) > narrating > mechanical/loading/pendingActions > open
 */
export function deriveInputGate(signals: InputGateSignals): InputGate {
  if (signals.phase === 'rolling' || signals.hasPlayerRollRequest) {
    return 'LOCKED_ROLLING';
  }

  if (signals.phase === 'narrating') {
    return 'LOCKED_NARRATING';
  }

  if (
    signals.phase === 'mechanical' ||
    signals.isLoading ||
    signals.hasPendingActions
  ) {
    return 'LOCKED_MECHANICAL';
  }

  return 'OPEN';
}

export function isStateChangingBlocked(gate: InputGate): boolean {
  return gate !== 'OPEN';
}

