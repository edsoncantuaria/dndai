// backend/src/services/authService.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import createError from 'http-errors';
import type { RegisterSchema } from '../schemas/validationSchemas.js';
import type { z } from 'zod';

// Configurações padrão para novos usuários
const defaultSettings = {
    model: "gemini-2.5-flash",
    ttsModel: "gemini-2.5-flash-preview-tts",
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
    useAiHomebrew: true,
};

export const registerUser = async (userData: z.infer<typeof RegisterSchema>) => {
    const userRepository = AppDataSource.getRepository(User);
    const { username, email, password } = userData;

    const existingUser = await userRepository.findOne({ where: [{ email }, { username }] });
    if (existingUser) {
        throw createError(409, 'Usuário ou email já existente.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User();
    user.username = username;
    user.email = email;
    user.password = hashedPassword;
    user.settings = defaultSettings;

    const savedUser = await userRepository.save(user);
    const { password: _, ...userResponse } = savedUser;
    return userResponse;
};


export const loginUser = async (email: string, password_input: string) => {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
        where: { email },
        relations: ["licenseKey"]
    });

    if (!user) {
        throw createError(404, 'Usuário não encontrado.');
    }

    const isMatch = await bcrypt.compare(password_input, user.password);
    if (!isMatch) {
        throw createError(401, 'Credenciais inválidas.');
    }

    const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || 'your_default_secret',
        { expiresIn: '7d' }
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userResponse } = user;

    return { token, userResponse };
}
