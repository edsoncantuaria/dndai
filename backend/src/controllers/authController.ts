// backend/src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import createError from 'http-errors';

// Configurações padrão para novos usuários
const defaultSettings = {
    model: "gemini-2.5-flash",
    ttsModel: "gemini-2.5-flash-native-audio",
    imageModel: "imagen-3",
    ttsVoice: "Charon",
    generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 8192,
    },
    volume: 0.3,
    isMuted: false,
    playMenuMusic: true,
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password || username.trim() === '') {
        return next(createError(400, 'Todos os campos são obrigatórios.'));
    }

    try {
        const userRepository = AppDataSource.getRepository(User);
        const existingUser = await userRepository.findOne({ where: [{ email }, { username }] });
        if (existingUser) {
            return next(createError(409, 'Usuário ou email já existente.'));
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = new User();
        user.username = username;
        user.email = email;
        user.password = hashedPassword;
        user.settings = defaultSettings; // Atribui as configurações padrão no registro

        await userRepository.save(user);

        res.status(201).json({ message: 'Usuário registrado com sucesso!' });
    } catch (error) {
        next(error);
    }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(createError(400, 'Email e senha são obrigatórios.'));
    }

    try {
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({ 
            where: { email },
            relations: ["licenseKey"] 
        });

        if (!user) {
            return next(createError(404, 'Usuário não encontrado.'));
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return next(createError(401, 'Credenciais inválidas.'));
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'your_default_secret',
            { expiresIn: '7d' }
        );
        
        const { password: userPassword, ...userResponse } = user;


        res.status(200).json({
            message: 'Login bem-sucedido!',
            token,
            user: userResponse,
        });

    } catch (error) {
        next(error);
    }
};
