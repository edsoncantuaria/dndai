// backend/src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import { RegisterSchema, LoginSchema } from '../schemas/validationSchemas.js';
import * as AuthService from '../services/authService.js';

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validatedBody = RegisterSchema.parse(req.body);
        const newUser = await AuthService.registerUser(validatedBody);
        res.status(201).json({ success: true, message: 'Usuário registrado com sucesso!', user: newUser });
    } catch (error: any) {
        next(error);
    }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { login, password } = LoginSchema.parse(req.body);
        const { token, userResponse } = await AuthService.loginUser(login, password);
        
        res.status(200).json({
            message: 'Login bem-sucedido!',
            token,
            user: userResponse,
        });

    } catch (error: any) {
        next(error);
    }
};
