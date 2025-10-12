// backend/src/services/authService.ts
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../database/data-source';
import { User } from '../models/User';
import { LicenseKey } from '../models/LicenseKey';
import createError from 'http-errors';

const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_jwt_super_secreto';

export const registerUser = async (username: string, email: string, password: string): Promise<User> => {
    const userRepository = AppDataSource.getRepository(User);
    const existingUser = await userRepository.findOne({ where: { email } });
    if (existingUser) {
        throw createError(409, 'E-mail já cadastrado.');
    }
    const user = new User();
    user.username = username;
    user.email = email;
    user.password = password;

    return userRepository.save(user);
};

export const loginUser = async (email: string, password: string): Promise<{ token: string; userId: number; isLicenseActive: boolean }> => {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ 
        where: { email },
        relations: ['license']
    });

    if (!user) {
        throw createError(401, 'Credenciais inválidas.');
    }

    const isMatch = await user.checkPassword(password);
    if (!isMatch) {
        throw createError(401, 'Credenciais inválidas.');
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    
    // Assegura que user.license não é null antes de acessar isActive
    const isLicenseActive = !!(user.license && user.license.isActive);
    
    return { token, userId: user.id, isLicenseActive };
};
