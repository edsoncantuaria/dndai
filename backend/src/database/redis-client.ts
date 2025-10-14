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
redisClient?.on('error', (err) => console.error('Erro no Cliente Redis:', err));
redisClient?.on('connect', () => console.log('[Cache] Conectando ao servidor Redis...'));
redisClient?.on('ready', () => console.log('[Cache] Cliente Redis pronto para uso.'));


// Conecta apenas se o cliente foi criado
if (redisClient) {
    console.log(`[Cache] Tentando conectar a: ${redisUrl.replace(/:[^@]+@/, ':[PASSWORD]@')}`);
    redisClient.connect().catch(err => {
        console.error('[Cache] Falha na conexão inicial com o Redis:', err)
    });
}

export default redisClient;
