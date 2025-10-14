// backend/src/controllers/userController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as UserService from '../services/userService.js';
import { SettingsSchema } from '../schemas/validationSchemas.js';
import createError from 'http-errors';

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'Não autorizado.'));
    }

    try {
        const userData = await UserService.getUserProfile(userId);
        res.status(200).json(userData);
    } catch (error) {
        next(error);
    }
};

export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'Não autorizado.'));
    }

    try {
        const newSettings = SettingsSchema.parse(req.body);
        await UserService.updateUserSettings(userId, newSettings);
        res.status(200).json({ message: 'Configurações atualizadas com sucesso!', settings: newSettings });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
}
