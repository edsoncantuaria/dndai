// backend/src/controllers/licenseController.ts
import { Request, Response, NextFunction } from 'express';
import * as licenseService from '../services/licenseService';
import createError from 'http-errors';

export const activateLicense = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            throw createError(401, 'Usuário não autenticado.');
        }
        const { key } = req.body;
        await licenseService.activateLicense(userId, key);
        res.status(200).json({ message: 'Licença ativada com sucesso!' });
    } catch (error) {
        next(error);
    }
};

export const getLicenseStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            throw createError(401, 'Usuário não autenticado.');
        }
        const licenseStatus = await licenseService.getLicenseStatus(userId);
        res.status(200).json(licenseStatus);
    } catch (error) {
        next(error);
    }
};
