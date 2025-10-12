// backend/src/services/licenseService.ts
import { AppDataSource } from '../database/data-source';
import { LicenseKey } from '../models/LicenseKey';
import createError from 'http-errors';

export const activateLicense = async (userId: number, key: string): Promise<void> => {
    const licenseRepository = AppDataSource.getRepository(LicenseKey);
    const license = await licenseRepository.findOne({ where: { key } });

    if (!license) {
        throw createError(404, 'Chave de licença inválida.');
    }

    if (license.userId || license.isActive) {
        throw createError(409, 'Chave de licença já está em uso.');
    }

    license.userId = userId;
    license.isActive = true;
    // Opcional: definir data de expiração
    // license.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 ano

    await licenseRepository.save(license);
};

export const getLicenseStatus = async (userId: number): Promise<{ isActive: boolean; key: string | null; expires_at: Date | null }> => {
    const licenseRepository = AppDataSource.getRepository(LicenseKey);
    const license = await licenseRepository.findOne({ where: { userId } });

    if (!license) {
        return { isActive: false, key: null, expires_at: null };
    }

    return {
        isActive: license.isActive,
        key: license.key,
        expires_at: license.expiresAt,
    };
};
