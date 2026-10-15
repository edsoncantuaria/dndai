import assert from 'node:assert/strict';
import test from 'node:test';

test('resolveRedisUrl: localhost → redis service em Docker', async () => {
    const prev = { ...process.env };
    try {
        process.env.REDIS_URL = 'redis://localhost:6379';
        process.env.DB_HOST = 'mysql';
        const { resolveRedisUrl } = await import('../config/redisUrl.js');
        assert.equal(resolveRedisUrl(), 'redis://redis:6379');
    } finally {
        process.env = prev;
    }
});

test('resolveRedisUrl: mantém URL fora do Docker', async () => {
    const prev = { ...process.env };
    try {
        process.env.REDIS_URL = 'redis://localhost:6379';
        delete process.env.DB_HOST;
        delete process.env.RUNNING_IN_DOCKER;
        const { resolveRedisUrl } = await import('../config/redisUrl.js');
        assert.equal(resolveRedisUrl(), 'redis://localhost:6379');
    } finally {
        process.env = prev;
    }
});
