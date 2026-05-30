// backend/src/services/authService.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import createError from 'http-errors';
import type { RegisterSchema } from '../schemas/validationSchemas.js';
import type { z } from 'zod';
import { includedCreditsForNewUser } from './aiBillingService.js';
import { AI_PRODUCT } from '../config/aiProductDefaults.js';

// Configurações padrão para novos usuários
const defaultSettings = {
    model: AI_PRODUCT.defaultModel,
    aiProvider: AI_PRODUCT.provider,
    ttsModel: "gemini-2.5-flash-preview-tts",
    ttsVoice: "Charon",
    narrationVoice: "faber",
    narrationSpeed: "normal",
    generationConfig: {
        temperature: 0.9,
        topP: 0.9,
        topK: 64,
        maxOutputTokens: 1024,
    },
    volume: 0.3,
    isMuted: false,
    playMenuMusic: true,
    playAmbientMusic: true,
    useAiHomebrew: true,
};

export const registerUser = async (userData: z.infer<typeof RegisterSchema>) => {
    const userRepository = AppDataSource.getRepository(User);
    const username = userData.username.trim();
    const email = userData.email.trim().toLowerCase();
    const { password } = userData;

    const existingUsername = await userRepository.findOne({ where: { username } });
    if (existingUsername) {
        const error = createError(409, 'O nome de usuário já está em uso.');
        (error as any).errors = { username: ['Este nome de usuário já está em uso.'] };
        throw error;
    }

    const existingEmail = await userRepository.findOne({ where: { email } });
    if (existingEmail) {
        const error = createError(409, 'O email informado já está cadastrado.');
        (error as any).errors = { email: ['Este email já está em uso.'] };
        throw error;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User();
    user.username = username;
    user.email = email;
    user.password = hashedPassword;
    user.settings = { ...defaultSettings, onboardingCompleted: false };
    user.aiCreditsRemaining = includedCreditsForNewUser();
    user.aiCreditsUsed = 0;

    const savedUser = await userRepository.save(user);
    const { password: _, ...userResponse } = savedUser;
    return userResponse;
};


export const loginUser = async (login: string, password_input: string) => {
    const userRepository = AppDataSource.getRepository(User);
    const normalizedLogin = login.trim();
    const isEmail = normalizedLogin.includes('@');

    const whereClause = isEmail
        ? { email: normalizedLogin.toLowerCase() }
        : { username: normalizedLogin };

    const user = await userRepository.findOne({
        where: whereClause,
        relations: ["licenseKey"]
    });

    if (!user) {
        const error = createError(401, 'Credenciais inválidas.');
        (error as any).errors = { login: ['Usuário ou email não encontrado.'] };
        throw error;
    }

    const isMatch = await bcrypt.compare(password_input, user.password);
    if (!isMatch) {
        const error = createError(401, 'Credenciais inválidas.');
        (error as any).errors = { password: ['Senha incorreta.'] };
        throw error;
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
