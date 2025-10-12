// backend/src/controllers/userController.ts
import { Request, Response, NextFunction } from 'express';
import { User } from '../models';

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // O ID do usuário é anexado ao objeto req pelo authMiddleware
        const userId = (req as any).user.id;
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] } // Nunca retorne a senha
        });

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};
