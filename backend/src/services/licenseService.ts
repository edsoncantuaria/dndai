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
        throw createError(409, 'Esta chave de licença já foi ativada.');
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

    return user.licenseKey?.isActivated || false;
};
