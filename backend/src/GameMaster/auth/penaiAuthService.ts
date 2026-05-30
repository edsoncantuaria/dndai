import bcrypt from 'bcryptjs';
import createError from 'http-errors';
import type { z } from 'zod';
import { PenaiDataSource } from '../database/data-source.js';
import { PenaiUser } from '../database/entities/PenaiUser.js';
import type { LoginSchema, RegisterSchema } from '../../schemas/validationSchemas.js';
import { includedCreditsForNewUser } from '../../services/aiBillingService.js';
import { AI_PRODUCT } from '../../config/aiProductDefaults.js';

const defaultSettings = {
    model: AI_PRODUCT.defaultModel,
    aiProvider: AI_PRODUCT.provider,
    ttsModel: 'gemini-2.5-flash-preview-tts',
    ttsVoice: 'Charon',
    narrationVoice: 'faber',
    narrationSpeed: 'normal',
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
    onboardingCompleted: false,
};

export async function registerPenaiUser(
    userData: z.infer<typeof RegisterSchema>,
): Promise<Omit<PenaiUser, 'passwordHash'>> {
    const repo = PenaiDataSource.getRepository(PenaiUser);
    const username = userData.username.trim();
    const email = userData.email.trim().toLowerCase();

    const existingUsername = await repo.findOne({ where: { username } });
    if (existingUsername) {
        const error = createError(409, 'O nome de usuário já está em uso.');
        (error as { errors?: Record<string, string[]> }).errors = {
            username: ['Este nome de usuário já está em uso.'],
        };
        throw error;
    }

    const existingEmail = await repo.findOne({ where: { email } });
    if (existingEmail) {
        const error = createError(409, 'O email informado já está cadastrado.');
        (error as { errors?: Record<string, string[]> }).errors = {
            email: ['Este email já está em uso.'],
        };
        throw error;
    }

    const passwordHash = await bcrypt.hash(userData.password, 12);
    const saved = await repo.save(
        repo.create({
            username,
            email,
            passwordHash,
            settings: { ...defaultSettings },
            aiCreditsRemaining: includedCreditsForNewUser(),
            aiCreditsUsed: 0,
            installedHomebrewIds: [],
            acknowledgedHomebrewDisclaimer: false,
        }),
    );

    const { passwordHash: _, ...userResponse } = saved;
    return userResponse;
}

export async function loginPenaiUser(
    login: string,
    passwordInput: string,
): Promise<{ user: Omit<PenaiUser, 'passwordHash'>; tokenPayload: { userId: number } }> {
    const repo = PenaiDataSource.getRepository(PenaiUser);
    const normalizedLogin = login.trim();
    const isEmail = normalizedLogin.includes('@');

    const user = await repo.findOne({
        where: isEmail
            ? { email: normalizedLogin.toLowerCase() }
            : { username: normalizedLogin },
    });

    if (!user) {
        const error = createError(401, 'Credenciais inválidas.');
        (error as { errors?: Record<string, string[]> }).errors = {
            login: ['Usuário ou email não encontrado.'],
        };
        throw error;
    }

    const isMatch = await bcrypt.compare(passwordInput, user.passwordHash);
    if (!isMatch) {
        const error = createError(401, 'Credenciais inválidas.');
        (error as { errors?: Record<string, string[]> }).errors = {
            password: ['Senha incorreta.'],
        };
        throw error;
    }

    const { passwordHash: _, ...userResponse } = user;
    return { user: userResponse, tokenPayload: { userId: user.id } };
}

export type LoginInput = z.infer<typeof LoginSchema>;
