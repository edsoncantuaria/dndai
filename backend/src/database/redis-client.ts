// backend/src/database/redis-client.ts
import { createClient } from 'redis';
import 'dotenv/config';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    console.warn("AVISO: REDIS_URL não está definida. O cache não será utilizado.");
}

const redisClient = redisUrl ? createClient({ url: redisUrl }) : null;

redisClient?.on('error', (err) => console.error('Erro no Cliente Redis:', err));

// Conecta apenas se o cliente foi criado
if (redisClient) {
    redisClient.connect().catch(console.error);
}

export default redisClient;
