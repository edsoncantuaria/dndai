import createError from 'http-errors';
import { PenaiDataSource } from '../database/data-source.js';
import { PenaiLicenseKey } from '../database/entities/PenaiLicenseKey.js';
import { PenaiUser } from '../database/entities/PenaiUser.js';

export async function activatePenaiLicense(key: string, userId: number): Promise<void> {
    const licenseRepo = PenaiDataSource.getRepository(PenaiLicenseKey);
    const license = await licenseRepo.findOne({ where: { key } });

    if (!license) {
        throw createError(404, 'Chave de licença inválida.');
    }

    if (license.isActivated) {
        if (
            license.activatedByUserId === userId &&
            (!license.expiresAt || license.expiresAt > new Date())
        ) {
            return;
        }
        throw createError(409, 'Esta chave de licença já foi ativada por outro usuário ou está inválida.');
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
        throw createError(403, 'Esta chave de licença está expirada.');
    }

    license.isActivated = true;
    license.activatedByUserId = userId;
    await licenseRepo.save(license);

    const userRepo = PenaiDataSource.getRepository(PenaiUser);
    const user = await userRepo.findOneBy({ id: userId });
    if (!user) throw createError(404, 'Usuário não encontrado.');
    user.licenseKeyId = license.id;
    await userRepo.save(user);
}

export async function getPenaiLicenseStatus(userId: number): Promise<boolean> {
    const user = await PenaiDataSource.getRepository(PenaiUser).findOne({
        where: { id: userId },
    });
    if (!user?.licenseKeyId) return false;

    const license = await PenaiDataSource.getRepository(PenaiLicenseKey).findOne({
        where: { id: user.licenseKeyId },
    });
    if (!license?.isActivated) return false;
    if (license.expiresAt && license.expiresAt < new Date()) return false;
    return true;
}
