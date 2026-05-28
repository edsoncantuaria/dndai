/**
 * P5.1 — processo dedicado ao consumidor BullMQ (sem HTTP/WebSocket).
 * Uso: npm run worker:narration --prefix backend
 */
import 'dotenv/config';
import { AppDataSource } from './database/data-source.js';

const start = async () => {
    try {
        await AppDataSource.initialize();
        console.log('[narration-worker] MySQL conectado.');
        const { startNarrationWorkers } = await import('./queue/narrationWorker.js');
        startNarrationWorkers();
        console.log('[narration-worker] BullMQ consumer ativo.');
    } catch (error) {
        console.error('[narration-worker] Falha ao iniciar:', error);
        process.exit(1);
    }
};

void start();
