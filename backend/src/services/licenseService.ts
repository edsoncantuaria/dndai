// backend/src/services/licenseService.ts
import { AppDataSource } from '../database/data-source.js';
import { LicenseKey } from '../entities/LicenseKey.js';
import { User } from '../entities/User.js';
import createError from 'http-errors';

export const activateLicenseForKey = async (key: string, userId: number) => {
    const licenseRepository = AppDataSource.getRepository(LicenseKey);
    const license = await licenseRepository.findOne({ where: { key } });

    if (!license) {
        throw createError(404, 'Chave de licença inválida.');
    }

    if (license.isActivated) {
        // Se já estiver ativada pelo mesmo usuário e não expirou, não há problema.
        if (license.activatedByUserId === userId && (!license.expiresAt || license.expiresAt > new Date())) {
             // Opcional: talvez logar ou apenas retornar sucesso silenciosamente.
        } else {
            throw createError(409, 'Esta chave de licença já foi ativada por outro usuário ou está inválida.');
        }
    }

    // Se a chave tiver uma data de expiração e ela já passou, nega a ativação.
    if (license.expiresAt && license.expiresAt < new Date()) {
        throw createError(403, 'Esta chave de licença está expirada.');
    }

    license.isActivated = true;
    license.activatedByUserId = userId;
    await licenseRepository.save(license);

    const userRepository = AppDataSource.getRepository(User);
    await userRepository.update(userId, { licenseKeyId: license.id });
};

export const getLicenseStatusForUser = async (userId: number): Promise<boolean> => {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
        where: { id: userId },
        relations: ["licenseKey"]
    });

    if (!user) {
        throw createError(404, 'Usuário não encontrado.');
    }

    if (!user.licenseKey || !user.licenseKey.isActivated) {
        return false;
    }

    // Se a chave tem uma data de expiração, verifica se ela já passou.
    // Se não tiver data de expiração, é considerada válida para sempre.
    if (user.licenseKey.expiresAt && user.licenseKey.expiresAt < new Date()) {
        return false;
    }

    return true;
};
