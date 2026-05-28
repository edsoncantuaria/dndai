/**
 * F.1 — fase do turno no cliente (slice leve; migrar para Zustand depois).
 */
export type TurnPipelinePhase = 'idle' | 'rolling' | 'mechanical' | 'narrating';

type Listener = (phase: TurnPipelinePhase) => void;

let phase: TurnPipelinePhase = 'idle';
const listeners = new Set<Listener>();

export function getTurnPipelinePhase(): TurnPipelinePhase {
    return phase;
}

export function setTurnPipelinePhase(next: TurnPipelinePhase): void {
    if (phase === next) return;
    phase = next;
    listeners.forEach(fn => fn(phase));
}

export function subscribeTurnPipeline(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
