import { fileURLToPath } from 'url';
import path from 'path';
import { Worker, NativeConnection } from '@temporalio/worker';
import { penaiEnv } from '../config/penaiEnv.js';
import * as activities from './activities/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startPenaiTemporalWorker(): Promise<Worker | null> {
    if (penaiEnv.TEMPORAL_DISABLED) return null;

    const connection = await NativeConnection.connect({
        address: penaiEnv.TEMPORAL_ADDRESS,
    });

    const worker = await Worker.create({
        connection,
        namespace: penaiEnv.TEMPORAL_NAMESPACE,
        taskQueue: 'penai-narration',
        workflowsPath: path.join(__dirname, 'workflows'),
        activities,
    });

    void worker.run();
    console.log('[PENAI][Temporal] Worker ativo na fila penai-narration');
    return worker;
}
