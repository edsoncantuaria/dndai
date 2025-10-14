// backend/src/controllers/licenseController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as LicenseService from '../services/licenseService.js';
import { ActivateLicenseSchema } from '../schemas/validationSchemas.js';
import createError from 'http-errors';

export const activateLicense = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }

    try {
        const { key } = ActivateLicenseSchema.parse(req.body);
        await LicenseService.activateLicenseForKey(key, userId);
        res.status(200).json({ success: true, message: 'Licença ativada com sucesso!' });

    } catch (error: any) {
        if (error.name === 'ZodError') {
            return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
};

export const getLicenseStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }

    try {
        const isActive = await LicenseService.getLicenseStatusForUser(userId);
        res.status(200).json({ isActive });
    } catch (error) {
        next(error);
    }
};
