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
        // Garante que a relação com a chave de licença seja carregada
        const user = await userRepository.findOne({ 
            where: { id: userId },
            relations: ["licenseKey"] 
        });

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

export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    const newSettings = req.body;

    if (!userId) {
        return next(createError(401, 'Não autorizado.'));
    }
    if (!newSettings || typeof newSettings !== 'object') {
        return next(createError(400, 'Corpo da requisição de configurações inválido.'));
    }

    try {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOneBy({ id: userId });
        
        if (!user) {
            return next(createError(404, 'Usuário não encontrado.'));
        }
        
        // Junta as configurações antigas com as novas para não sobrescrever tudo
        const updatedSettings = { ...(user.settings || {}), ...newSettings };

        await userRepository.update(userId, { settings: updatedSettings });
        
        res.status(200).json({ message: 'Configurações atualizadas com sucesso!', settings: updatedSettings });

    } catch (error) {
        next(error);
    }
}
