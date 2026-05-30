import createError from 'http-errors';
import type { z } from 'zod';
import { PenaiDataSource } from '../database/data-source.js';
import { PenaiUser } from '../database/entities/PenaiUser.js';
import type { SettingsSchema } from '../../schemas/validationSchemas.js';
import {
    buildAiAccessStatus,
} from '../../services/aiBillingService.js';

function isOnboardingCompleted(settings?: Record<string, unknown> | null): boolean {
    return Boolean(settings?.onboardingCompleted);
}

export async function getPenaiUserProfile(userId: number) {
    const user = await PenaiDataSource.getRepository(PenaiUser).findOne({
        where: { id: userId },
    });
    if (!user) throw createError(404, 'Usuário não encontrado.');
    const { passwordHash: _, ...userData } = user;
    return userData;
}

export async function getPenaiUserMe(userId: number) {
    const userData = await getPenaiUserProfile(userId);
    const aiAccess = buildAiAccessStatus(userData, userData.apiKey);
    const { apiKey: _apiKey, ...safeUser } = userData;
    return {
        ...safeUser,
        aiAccess,
        onboardingCompleted: isOnboardingCompleted(userData.settings),
    };
}

export async function updatePenaiUserSettings(
    userId: number,
    newSettings: z.infer<typeof SettingsSchema>,
) {
    const repo = PenaiDataSource.getRepository(PenaiUser);
    const user = await repo.findOneBy({ id: userId });
    if (!user) throw createError(404, 'Usuário não encontrado.');

    const { apiKey, ...settingsToSave } = newSettings;
    user.settings = { ...(user.settings ?? {}), ...settingsToSave };
    if (apiKey !== undefined) {
        user.apiKey = apiKey || null;
    }
    await repo.save(user);
    return user.settings;
}

export async function setPenaiHomebrewDisclaimerAcknowledged(userId: number) {
    const result = await PenaiDataSource.getRepository(PenaiUser).update(userId, {
        acknowledgedHomebrewDisclaimer: true,
    });
    if ((result.affected ?? 0) === 0) {
        throw createError(404, 'Usuário não encontrado.');
    }
}

export async function completePenaiUserOnboarding(userId: number) {
    const repo = PenaiDataSource.getRepository(PenaiUser);
    const user = await repo.findOneBy({ id: userId });
    if (!user) throw createError(404, 'Usuário não encontrado.');
    user.settings = { ...(user.settings ?? {}), onboardingCompleted: true };
    await repo.save(user);
}

export async function updatePenaiUserHomebrewInstallation(
    userId: number,
    itemId: string,
    action: 'install' | 'uninstall',
) {
    const repo = PenaiDataSource.getRepository(PenaiUser);
    const user = await repo.findOneBy({ id: userId });
    if (!user) throw createError(404, 'Usuário não encontrado.');

    const { PenaiHomebrewContent } = await import('../database/entities/HomebrewContent.js');
    const { PenaiHomebrewBundle } = await import('../database/entities/HomebrewBundle.js');

    const contentRepo = PenaiDataSource.getRepository(PenaiHomebrewContent);
    const bundleRepo = PenaiDataSource.getRepository(PenaiHomebrewBundle);

    const content = await contentRepo.findOneBy({ id: itemId });
    const bundle = await bundleRepo.findOne({
        where: { id: itemId },
        relations: ['contents'],
    });

    if (!content && !bundle) {
        throw createError(404, 'Conteúdo ou Pacote Homebrew não encontrado.');
    }

    if (content && !content.isPublic && content.authorId !== userId) {
        throw createError(403, 'Você não tem permissão para instalar este conteúdo privado.');
    }
    if (bundle && !bundle.isPublic && bundle.authorId !== userId) {
        throw createError(403, 'Você não tem permissão para instalar este pacote privado.');
    }

    const currentIds = new Set(user.installedHomebrewIds ?? []);

    if (action === 'install') {
        currentIds.add(itemId);
    } else {
        currentIds.delete(itemId);
        if (bundle?.contents) {
            for (const c of bundle.contents) {
                currentIds.delete(c.id);
            }
        }
    }

    user.installedHomebrewIds = Array.from(currentIds);
    const saved = await repo.save(user);
    const { passwordHash: _, ...userResponse } = saved;
    return userResponse;
}

export async function invalidatePenaiUserCache(userId: number) {
    console.log(`[PENAI][Cache] Cache invalidado para usuário ${userId}.`);
}
