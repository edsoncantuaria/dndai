'use client';

import { useEffect, useState } from 'react';
import {
    getTurnPipelinePhase,
    subscribeTurnPipeline,
    type TurnPipelinePhase,
} from '@/hooks/game/turnPipelineStore';

/** F.1 — fase do turno reativa para UI (loading, dock, etc.). */
export function useTurnPipeline(): TurnPipelinePhase {
    const [phase, setPhase] = useState<TurnPipelinePhase>(() => getTurnPipelinePhase());

    useEffect(() => subscribeTurnPipeline(setPhase), []);

    return phase;
}
