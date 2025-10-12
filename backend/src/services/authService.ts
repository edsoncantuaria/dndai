// backend/src/services/authService.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import createError from 'http-errors';

const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_jwt_super_secreto';

export const registerUser = async (username: string, email: string, password: string): Promise<User> => {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        throw createError(409, 'E-mail já cadastrado.');
    }
    const user = await User.create({ username, email, password });
    return user;
};

export const loginUser = async (email: string, password: string): Promise<{ token: string; userId: number }> => {
    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw createError(401, 'Credenciais inválidas.');
    }

    const isMatch = await user.checkPassword(password);
    if (!isMatch) {
        throw createError(401, 'Credenciais inválidas.');
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return { token, userId: user.id };
};
