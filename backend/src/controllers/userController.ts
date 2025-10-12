// backend/src/controllers/userController.ts
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import createError from 'http-errors';

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return next(createError(401, 'Não autorizado.'));
        }

        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ where: { id: userId } });

        if (!user) {
            return next(createError(404, 'Usuário não encontrado.'));
        }

        // Retorna dados do usuário sem a senha
        const { password, ...userData } = user;
        res.status(200).json(userData);

    } catch (error) {
        next(error);
    }
};
