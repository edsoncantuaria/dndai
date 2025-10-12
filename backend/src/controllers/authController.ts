// backend/src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { username, email, password } = req.body;
        const newUser = await authService.registerUser(username, email, password);
        res.status(201).json({ message: 'Usuário registrado com sucesso!', userId: newUser.id });
    } catch (error) {
        next(error);
    }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body;
        const { token, userId } = await authService.loginUser(email, password);
        res.status(200).json({ token, userId });
    } catch (error) {
        next(error);
    }
};
