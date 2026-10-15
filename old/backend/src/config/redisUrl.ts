/**
 * REDIS_URL do .env costuma apontar para localhost; em Docker o serviço é `redis`.
 */
export function resolveRedisUrl(): string | undefined {
    const raw = process.env.REDIS_URL;
    if (!raw || raw === 'mock') return raw;

    const inDocker =
        process.env.DB_HOST === 'mysql' ||
        process.env.RUNNING_IN_DOCKER === 'true' ||
        process.env.DOCKER === 'true';

    if (inDocker && /localhost|127\.0\.0\.1/.test(raw)) {
        return 'redis://redis:6379';
    }
    return raw;
}
