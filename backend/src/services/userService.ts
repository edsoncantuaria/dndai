// backend/src/services/userService.ts
import { AppDataSource } from '../database/data-source.js';
import { User } from '../entities/User.js';
import createError from 'http-errors';
import type { SettingsSchema } from '../schemas/validationSchemas.js';
import type { z } from 'zod';
import { HomebrewContent } from '../entities/HomebrewContent.js';

export const getUserProfile = async (userId: number) => {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ 
        where: { id: userId },
        relations: ["licenseKey"] 
    });

    if (!user) {
        throw createError(404, 'Usuário não encontrado.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userData } = user;
    return userData;
};

export const updateUserSettings = async (userId: number, newSettings: z.infer<typeof SettingsSchema>) => {
    const userRepository = AppDataSource.getRepository(User);
    // A chave de API agora é gerenciada pelo frontend, então vamos garantir que ela não seja salva aqui.
    const { apiKey, ...settingsToSave } = newSettings;
    const result = await userRepository.update(userId, { settings: settingsToSave });

    if(result.affected === 0) {
        throw createError(404, 'Usuário não encontrado para atualizar as configurações.');
    }
};

export const setHomebrewDisclaimerAsAcknowledged = async (userId: number) => {
    const userRepository = AppDataSource.getRepository(User);
    const result = await userRepository.update(userId, { acknowledgedHomebrewDisclaimer: true });
    if (result.affected === 0) {
        throw createError(404, 'Usuário não encontrado para atualizar a confirmação.');
    }
};

export const updateUserHomebrewInstallation = async (userId: number, homebrewId: string, action: 'install' | 'uninstall') => {
    const userRepository = AppDataSource.getRepository(User);
    const contentRepository = AppDataSource.getRepository(HomebrewContent);
    const user = await userRepository.findOneBy({ id: userId });

    if (!user) {
        throw createError(404, 'Usuário não encontrado.');
    }

    const content = await contentRepository.findOneBy({ id: homebrewId });
    if (!content) {
        throw createError(404, 'Conteúdo Homebrew não encontrado.');
    }
    if (!content.isPublic && content.authorId !== userId) {
        throw createError(403, 'Você não tem permissão para instalar este conteúdo privado.');
    }

    let currentIds = user.installedHomebrewIds || [];

    if (action === 'install') {
        if (!currentIds.includes(homebrewId)) {
            currentIds.push(homebrewId);
        }
    } else { // uninstall
        currentIds = currentIds.filter(id => id !== homebrewId);
    }
    
    user.installedHomebrewIds = [...new Set(currentIds)];

    const savedUser = await userRepository.save(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userResponse } = savedUser;
    return userResponse;
};
