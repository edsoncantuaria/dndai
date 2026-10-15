/**
 * F.1 — fase do turno no cliente (slice leve; migrar para Zustand depois).
 */
import type { InputGate } from '@/hooks/game/inputGate';

export type TurnPipelinePhase = 'idle' | 'rolling' | 'mechanical' | 'narrating';

type Listener = (phase: TurnPipelinePhase) => void;

let phase: TurnPipelinePhase = 'idle';
const listeners = new Set<Listener>();

type InputGateListener = (gate: InputGate) => void;

let inputGate: InputGate = 'OPEN';
const inputGateListeners = new Set<InputGateListener>();

let vitalsGameOver = false;
let vitalsUnconsciousAtZero = false;

export function setVitalsInputSignals(signals: {
    gameOver?: boolean;
    unconsciousAtZero?: boolean;
}): void {
    if (signals.gameOver !== undefined) vitalsGameOver = signals.gameOver;
    if (signals.unconsciousAtZero !== undefined) vitalsUnconsciousAtZero = signals.unconsciousAtZero;
}

export function getVitalsInputSignals(): { gameOver: boolean; unconsciousAtZero: boolean } {
    return { gameOver: vitalsGameOver, unconsciousAtZero: vitalsUnconsciousAtZero };
}

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

export function getInputGate(): InputGate {
    return inputGate;
}

export function setInputGate(next: InputGate): void {
    if (inputGate === next) return;
    inputGate = next;
    inputGateListeners.forEach(fn => fn(inputGate));
}

export function subscribeInputGate(fn: InputGateListener): () => void {
    inputGateListeners.add(fn);
    return () => inputGateListeners.delete(fn);
}
