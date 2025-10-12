// backend/src/services/licenseService.ts
import { LicenseKey, User } from '../models';
import createError from 'http-errors';

export const activateLicense = async (userId: number, key: string): Promise<void> => {
    const license = await LicenseKey.findOne({ where: { key } });

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

    await license.save();
};

export const getLicenseStatus = async (userId: number): Promise<{ isActive: boolean; key: string; expires_at: Date | null }> => {
    const license = await LicenseKey.findOne({ where: { userId } });

    if (!license || !license.isActive) {
        throw createError(404, 'Nenhuma licença ativa encontrada para este usuário.');
    }

    return {
        isActive: license.isActive,
        key: license.key,
        expires_at: license.expiresAt,
    };
};
