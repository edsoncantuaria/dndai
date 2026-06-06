import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { penaiIntegrationDescribe } from './helpers/penaiIntegrationDescribe.js';
import { PenaiDataSource } from '../GameMaster/database/data-source.js';
import { PenaiUser } from '../GameMaster/database/entities/PenaiUser.js';
import { registerPenaiUser, loginPenaiUser } from '../GameMaster/auth/penaiAuthService.js';

penaiIntegrationDescribe('penai auth v2 (integration)', () => {
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

    it('login instala bundle srd-ptbr para usuário legado', async () => {
        const { seedSrdPtBrHomebrew, getSrdPtBrCoreBundleId } = await import(
            '../GameMaster/database/seed/seedSrdPtBrHomebrew.js'
        );
        await seedSrdPtBrHomebrew();
        const bundleId = await getSrdPtBrCoreBundleId();
        assert.ok(bundleId);

        const repo = PenaiDataSource.getRepository(PenaiUser);
        const suffix = Date.now();
        await repo.save(
            repo.create({
                username: `legacy${suffix}`,
                email: `legacy${suffix}@example.com`,
                passwordHash: await bcrypt.hash('secret123', 12),
                settings: {},
                aiCreditsRemaining: 30,
                installedHomebrewIds: [],
            }),
        );

        const { user: logged } = await loginPenaiUser(`legacy${suffix}@example.com`, 'secret123');
        assert.ok(logged.installedHomebrewIds?.includes(bundleId!));
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

    it('salva apiKey BYOK e resolve inferência sem expor chave no /me', async () => {
        const { updatePenaiUserSettings, getPenaiUserMe } = await import(
            '../GameMaster/auth/penaiUserService.js'
        );
        const { resolvePenaiInferenceApiKey } = await import(
            '../GameMaster/auth/penaiAiBillingService.js'
        );
        const suffix = Date.now();
        const user = await registerPenaiUser({
            username: `byok${suffix}`,
            email: `byok${suffix}@example.com`,
            password: 'secret123',
        });
        const fakeKey = `AIzaSyD${'x'.repeat(30)}`;
        await updatePenaiUserSettings(user.id, { apiKey: fakeKey });
        const me = await getPenaiUserMe(user.id);
        assert.equal((me as { apiKey?: string }).apiKey, undefined);
        assert.equal(me.aiAccess?.canInfer, true);
        assert.equal(me.aiAccess?.hasByok, true);
        const resolved = await resolvePenaiInferenceApiKey(user.id);
        assert.equal(resolved, fakeKey);
    });

    it('getPenaiUserMe expõe licenseKey.isActivated após ativar licença', async () => {
        const { getPenaiUserMe } = await import('../GameMaster/auth/penaiUserService.js');
        const { activatePenaiLicense } = await import('../GameMaster/auth/penaiLicenseService.js');
        const { PenaiLicenseKey } = await import('../GameMaster/database/entities/PenaiLicenseKey.js');

        const suffix = Date.now();
        const user = await registerPenaiUser({
            username: `lic${suffix}`,
            email: `lic${suffix}@example.com`,
            password: 'secret123',
        });

        const licenseRepo = PenaiDataSource.getRepository(PenaiLicenseKey);
        const key = `TEST-${suffix}`;
        await licenseRepo.save(licenseRepo.create({ key, isActivated: false }));

        let me = await getPenaiUserMe(user.id);
        assert.equal(me.licenseKey?.isActivated, false);

        await activatePenaiLicense(key, user.id);
        me = await getPenaiUserMe(user.id);
        assert.equal(me.licenseKey?.isActivated, true);
    });
});

describe('penai auth v2 (unit)', () => {
    it('exports registerPenaiUser e loginPenaiUser', () => {
        assert.equal(typeof registerPenaiUser, 'function');
        assert.equal(typeof loginPenaiUser, 'function');
    });
});
