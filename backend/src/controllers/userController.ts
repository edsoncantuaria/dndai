// backend/src/controllers/userController.ts
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import createError from 'http-errors';
import { SettingsSchema } from '../schemas/validationSchemas.js';

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
    
    if (!userId) {
        return next(createError(401, 'Não autorizado.'));
    }

    try {
        const newSettings = SettingsSchema.parse(req.body);

        const userRepository = AppDataSource.getRepository(User);
        
        // Overwrite the settings object completely to ensure sync
        await userRepository.update(userId, { settings: newSettings });
        
        res.status(200).json({ message: 'Configurações atualizadas com sucesso!', settings: newSettings });

    } catch (error: any) {
        if (error.errors) { // Erro de validação do Zod
            return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
}
