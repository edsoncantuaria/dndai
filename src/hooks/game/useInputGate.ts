'use client';

import { useEffect, useState } from 'react';
import {
  getInputGate,
  subscribeInputGate,
  type InputGate,
} from '@/hooks/game/turnPipelineStore';

/** F.2 — input gate reativo para UI (bloqueio de inputs). */
export function useInputGate(): InputGate {
  const [gate, setGate] = useState<InputGate>(() => getInputGate());

  useEffect(() => subscribeInputGate(setGate), []);

  return gate;
}

