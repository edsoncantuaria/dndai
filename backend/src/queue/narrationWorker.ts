import { startBullNarrationWorker } from './narrationBullQueue.js';

/** Inicia o worker BullMQ no mesmo processo do API (dev e Docker). */
export function startNarrationWorkers(): void {
    startBullNarrationWorker();
}
