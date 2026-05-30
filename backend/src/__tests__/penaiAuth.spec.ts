import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { ensurePenaiTestDb } from './helpers/penaiTestDb.js';
import { PenaiDataSource } from '../GameMaster/database/data-source.js';
import { PenaiUser } from '../GameMaster/database/entities/PenaiUser.js';
import { registerPenaiUser, loginPenaiUser } from '../GameMaster/auth/penaiAuthService.js';

const dbDescribe = process.env.DATABASE_URL ? describe : describe.skip;

dbDescribe('penai auth v2 (integration)', () => {
    before(async () => {
        const ok = await ensurePenaiTestDb();
        if (!ok) throw new Error('PostgreSQL indisponível');
    });

    it('register + login retorna userId válido', async () => {
        const suffix = Date.now();
        const user = await registerPenaiUser({
            username: `test${suffix}`,
            email: `test${suffix}@example.com`,
            password: 'secret123',
        });
        assert.ok(user.id);

        const { user: logged, tokenPayload } = await loginPenaiUser(
            `test${suffix}@example.com`,
            'secret123',
        );
        assert.equal(logged.id, user.id);
        assert.equal(tokenPayload.userId, user.id);
    });

    it('login com senha errada falha', async () => {
        const repo = PenaiDataSource.getRepository(PenaiUser);
        const suffix = Date.now();
        await repo.save(
            repo.create({
                username: `fail${suffix}`,
                email: `fail${suffix}@example.com`,
                passwordHash: await bcrypt.hash('right', 12),
                settings: {},
                aiCreditsRemaining: 30,
            }),
        );
        await assert.rejects(() => loginPenaiUser(`fail${suffix}@example.com`, 'wrong'));
    });
});

describe('penai auth v2 (unit)', () => {
    it('exports registerPenaiUser e loginPenaiUser', () => {
        assert.equal(typeof registerPenaiUser, 'function');
        assert.equal(typeof loginPenaiUser, 'function');
    });
});
