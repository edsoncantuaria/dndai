// backend/src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import { RegisterSchema, LoginSchema } from '../schemas/validationSchemas.js';
import * as AuthService from '../services/authService.js';
import createError from 'http-errors';

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validatedBody = RegisterSchema.parse(req.body);
        const newUser = await AuthService.registerUser(validatedBody);
        res.status(201).json({ success: true, message: 'Usuário registrado com sucesso!', user: newUser });
    } catch (error: any) {
        // ZodError is handled by middleware, but we can catch specific service errors
        if (error.name === 'ZodError') {
             return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = LoginSchema.parse(req.body);
        const { token, userResponse } = await AuthService.loginUser(email, password);
        
        res.status(200).json({
            message: 'Login bem-sucedido!',
            token,
            user: userResponse,
        });

    } catch (error: any) {
        if (error.name === 'ZodError') {
             return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
};
