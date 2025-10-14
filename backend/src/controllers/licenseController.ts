// backend/src/controllers/licenseController.ts
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { LicenseKey } from '../entities/LicenseKey.js';
import { User } from '../entities/User.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import createError from 'http-errors';
import { ActivateLicenseSchema } from '../schemas/validationSchemas.js';

export const activateLicense = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    try {
        const { key } = ActivateLicenseSchema.parse(req.body);

        const licenseRepository = AppDataSource.getRepository(LicenseKey);
        const license = await licenseRepository.findOne({ where: { key } });

        if (!license) {
            return next(createError(404, 'Chave de licença inválida.'));
        }

        if (license.isActivated) {
            return next(createError(409, 'Esta chave de licença já foi ativada.'));
        }

        license.isActivated = true;
        license.activatedByUserId = userId!;
        await licenseRepository.save(license);

        const userRepository = AppDataSource.getRepository(User);
        await userRepository.update(userId!, { licenseKeyId: license.id });


        res.status(200).json({ success: true, message: 'Licença ativada com sucesso!' });

    } catch (error: any) {
         if (error.errors) { // Erro de validação do Zod
            return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
};

export const getLicenseStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    try {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { id: userId },
            relations: ["licenseKey"]
        });

        if (!user) {
            return next(createError(404, 'Usuário não encontrado.'));
        }

        res.status(200).json({
            isActive: user.licenseKey?.isActivated || false
        });

    } catch (error) {
        next(error);
    }
};
