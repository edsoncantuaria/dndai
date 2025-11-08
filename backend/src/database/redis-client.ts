// backend/src/database/redis-client.ts
import { createClient } from 'redis';
import 'dotenv/config';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    console.warn("AVISO: REDIS_URL não está definida. O cache não será utilizado.");
}

// O cliente é criado apenas se a URL existir.
const redisClient = redisUrl ? createClient({ url: redisUrl }) : null;

// Adicionando listeners de eventos para depuração
redisClient?.on('error', (err) => console.error('[Cache] Erro no Cliente Redis:', err));
redisClient?.on('connect', () => console.log('[Cache] Conectando ao servidor Redis...'));
redisClient?.on('ready', () => console.log('[Cache] Cliente Redis pronto para uso.'));


let connectionPromise: Promise<void> | null = null;

const connectRedis = () => {
    if (!redisClient) return null;
    if (redisClient.isOpen) return Promise.resolve();
    if (!connectionPromise) {
        console.log(`[Cache] Tentando conectar a: ${redisUrl!.replace(/:[^@]+@/, ':[PASSWORD]@')}`);
        connectionPromise = redisClient.connect().then(() => undefined).catch(err => {
            console.error('[Cache] Falha na conexão inicial com o Redis:', err);
            connectionPromise = null;
        });
    }
    return connectionPromise;
};

if (redisClient) {
    await connectRedis();
}

export const ensureRedisConnection = async () => {
    if (!redisClient) return null;
    await connectRedis();
    return redisClient;
};

export default redisClient;
